import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { users } from '../../db/schema'
import { getSessionUserId } from './lib/session'
import { authRouter } from './routes/auth'
import { robotsRouter } from './routes/robots'
import { installationsRouter } from './routes/installations'
import { geocodeRouter } from './routes/geocode'
import { remindersRouter } from './routes/reminders'
import type { AppContext } from './types'

const app = new Hono<AppContext>()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (_origin, c) => c.env.APP_ORIGIN || 'http://localhost:8788',
    credentials: true,
  })
)

// Inject db into context
app.use('*', async (c, next) => {
  c.set('db', getDb(c.env.NEON_DATABASE_URL))
  await next()
})

app.route('/api/auth', authRouter)
app.route('/api/robots', robotsRouter)
app.route('/api/installations', installationsRouter)
app.route('/api', geocodeRouter)
app.route('/api/reminders', remindersRouter)

// GET /api/me — standalone (not under /auth)
app.get('/api/me', async (c) => {
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

app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

export const onRequest = handle(app)
