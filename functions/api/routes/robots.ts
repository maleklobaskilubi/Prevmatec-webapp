import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { robots } from '../../../db/schema'
import { requireAuth } from '../lib/session'
import { CreateRobotSchema } from '../../../shared/schemas'
import type { AppContext } from '../types'

export const robotsRouter = new Hono<AppContext>()

robotsRouter.use('*', requireAuth)

robotsRouter.get('/', async (c) => {
  const db = c.get('db')
  const rows = await db
    .select()
    .from(robots)
    .orderBy(robots.name)
  return c.json(rows)
})

robotsRouter.post('/', zValidator('json', CreateRobotSchema), async (c) => {
  const body = c.req.valid('json')
  const db = c.get('db')
  const [robot] = await db.insert(robots).values(body).returning()
  return c.json(robot, 201)
})

robotsRouter.delete('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  await db.delete(robots).where(eq(robots.id, id))
  return c.json({ ok: true })
})
