import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { eq, gt } from 'drizzle-orm'
import { sessions } from '../../../db/schema'
import type { AppContext } from '../types'

const SESSION_COOKIE = 'sid'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function createSession(
  c: Context<AppContext>,
  userId: string
): Promise<string> {
  const db = c.get('db')
  const { generateSessionId } = await import('./crypto')
  const id = generateSessionId()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    userAgent: c.req.header('user-agent') ?? null,
    ip: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null,
  })

  setCookie(c, SESSION_COOKIE, id, {
    httpOnly: true,
    secure: c.env.APP_ORIGIN?.startsWith('https'),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })

  return id
}

export async function destroySession(c: Context<AppContext>): Promise<void> {
  const db = c.get('db')
  const sid = getCookie(c, SESSION_COOKIE)
  if (sid) {
    await db.delete(sessions).where(eq(sessions.id, sid)).catch(() => {})
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/', httpOnly: true })
}

export async function getSessionUserId(
  c: Context<AppContext>
): Promise<string | null> {
  const db = c.get('db')
  const sid = getCookie(c, SESSION_COOKIE)
  if (!sid) return null

  const [session] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, sid))
    .limit(1)

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sid)).catch(() => {})
    return null
  }
  return session.userId
}

// Middleware: require auth, inject userId into context
export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const userId = await getSessionUserId(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('userId', userId)
  await next()
}
