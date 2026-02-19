import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { users, userIdentities } from '../../../db/schema'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { createSession, destroySession, getSessionUserId } from '../lib/session'
import { RegisterSchema, LoginSchema, GoogleInviteSchema } from '../../../shared/schemas'
import type { AppContext } from '../types'

export const authRouter = new Hono<AppContext>()

// ─── Email/password register ──────────────────────────────────────────────────

authRouter.post('/register', zValidator('json', RegisterSchema), async (c) => {
  const { email, password, name, inviteCode } = c.req.valid('json')

  if (inviteCode !== c.env.INVITE_CODE) {
    return c.json({ error: 'Neplatný pozvánkový kód' }, 400)
  }

  const db = c.get('db')
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    return c.json({ error: 'Email je už zaregistrovaný' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const [user] = await db.insert(users).values({ email, name, passwordHash }).returning()

  await createSession(c, user.id)
  return c.json({ id: user.id, email: user.email, name: user.name }, 201)
})

// ─── Email/password login ─────────────────────────────────────────────────────

authRouter.post('/login', zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  const db = c.get('db')

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user || !user.passwordHash) {
    return c.json({ error: 'Nesprávny email alebo heslo' }, 401)
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Nesprávny email alebo heslo' }, 401)
  }

  await createSession(c, user.id)
  return c.json({ id: user.id, email: user.email, name: user.name })
})

// ─── Logout ───────────────────────────────────────────────────────────────────

authRouter.post('/logout', async (c) => {
  await destroySession(c)
  return c.json({ ok: true })
})

// ─── Current user ─────────────────────────────────────────────────────────────

authRouter.get('/me', async (c) => {
  const userId = await getSessionUserId(c)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const db = c.get('db')
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json(user)
})

// ─── Google OAuth – start ─────────────────────────────────────────────────────

authRouter.get('/google/start', (c) => {
  const state = crypto.randomUUID()
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${c.env.APP_ORIGIN}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  // Store state in cookie (simple CSRF protection)
  const res = Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
  const headers = new Headers(res.headers)
  headers.append(
    'Set-Cookie',
    `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${c.env.APP_ORIGIN?.startsWith('https') ? '; Secure' : ''}`
  )
  return new Response(null, { status: 302, headers })
})

// ─── Google OAuth – callback ──────────────────────────────────────────────────

authRouter.get('/google/callback', async (c) => {
  const { code, state, error } = c.req.query()
  const origin = c.env.APP_ORIGIN

  if (error) return c.redirect(`${origin}/login?error=google_denied`)

  // Validate state (CSRF)
  const cookieHeader = c.req.header('cookie') ?? ''
  const oauthState = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('oauth_state='))
    ?.split('=')[1]

  if (!state || state !== oauthState) {
    return c.redirect(`${origin}/login?error=invalid_state`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) return c.redirect(`${origin}/login?error=token_exchange_failed`)

  const tokens = await tokenRes.json() as { id_token?: string; access_token?: string }

  // Get user info from Google
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userInfoRes.ok) return c.redirect(`${origin}/login?error=userinfo_failed`)

  const googleUser = await userInfoRes.json() as {
    sub: string
    email: string
    name: string
    email_verified: boolean
  }

  const db = c.get('db')

  // Check if identity exists
  const [identity] = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(eq(userIdentities.providerUserId, googleUser.sub))
    .limit(1)

  if (identity) {
    // Existing user – create session
    await createSession(c, identity.userId)
    return c.redirect(`${origin}/map`)
  }

  // New Google user – redirect to invite page with a pending token
  // We store google info temporarily as a signed token in a short-lived cookie
  const pendingData = JSON.stringify({
    sub: googleUser.sub,
    email: googleUser.email,
    name: googleUser.name,
  })
  const pendingEncoded = btoa(pendingData)

  const headers = new Headers()
  headers.set('Location', `${origin}/invite`)
  headers.append(
    'Set-Cookie',
    `pending_google=${pendingEncoded}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${origin?.startsWith('https') ? '; Secure' : ''}`
  )
  return new Response(null, { status: 302, headers })
})

// ─── Complete Google registration with invite code ────────────────────────────

authRouter.post('/google/complete', zValidator('json', GoogleInviteSchema), async (c) => {
  const { inviteCode, pendingToken } = c.req.valid('json')

  if (inviteCode !== c.env.INVITE_CODE) {
    return c.json({ error: 'Neplatný pozvánkový kód' }, 400)
  }

  let googleInfo: { sub: string; email: string; name: string }
  try {
    googleInfo = JSON.parse(atob(pendingToken))
    if (!googleInfo.sub || !googleInfo.email) throw new Error()
  } catch {
    return c.json({ error: 'Neplatný token' }, 400)
  }

  const db = c.get('db')

  // Check if already registered
  const [existingIdentity] = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(eq(userIdentities.providerUserId, googleInfo.sub))
    .limit(1)

  if (existingIdentity) {
    await createSession(c, existingIdentity.userId)
    return c.json({ ok: true })
  }

  // Find or create user by email
  let userId: string
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, googleInfo.email))
    .limit(1)

  if (existingUser) {
    userId = existingUser.id
  } else {
    const [newUser] = await db
      .insert(users)
      .values({ email: googleInfo.email, name: googleInfo.name })
      .returning({ id: users.id })
    userId = newUser.id
  }

  await db.insert(userIdentities).values({
    userId,
    provider: 'google',
    providerUserId: googleInfo.sub,
    email: googleInfo.email,
  })

  await createSession(c, userId)
  return c.json({ ok: true })
})
