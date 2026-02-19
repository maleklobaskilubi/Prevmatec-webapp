import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { and, eq, sql } from 'drizzle-orm'
import { installationGroups, installationGroupItems } from '../../../db/schema'
import { requireAuth } from '../lib/session'
import { CreateGroupSchema } from '../../../shared/schemas'
import type { AppContext } from '../types'

export const groupsRouter = new Hono<AppContext>()

groupsRouter.use('*', requireAuth)

// ─── GET /api/groups ──────────────────────────────────────────────────────────

groupsRouter.get('/', async (c) => {
  const db = c.get('db')

  const rows = await db
    .select({
      id: installationGroups.id,
      name: installationGroups.name,
      color: installationGroups.color,
      createdBy: installationGroups.createdBy,
      createdAt: installationGroups.createdAt,
      installationCount: sql<number>`(
        SELECT COUNT(*)::int FROM installation_group_items gi
        WHERE gi.group_id = ${installationGroups.id}
      )`,
    })
    .from(installationGroups)
    .orderBy(installationGroups.name)

  return c.json(rows)
})

// ─── POST /api/groups ─────────────────────────────────────────────────────────

groupsRouter.post('/', zValidator('json', CreateGroupSchema), async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const { name, color } = c.req.valid('json')

  const [group] = await db
    .insert(installationGroups)
    .values({ name, color: color ?? '#6366f1', createdBy: userId })
    .returning()

  return c.json(group, 201)
})

// ─── DELETE /api/groups/:id ───────────────────────────────────────────────────

groupsRouter.delete('/:id', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const { id } = c.req.param()

  const [existing] = await db
    .select({ createdBy: installationGroups.createdBy })
    .from(installationGroups)
    .where(eq(installationGroups.id, id))
    .limit(1)

  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.createdBy !== userId) return c.json({ error: 'Forbidden' }, 403)

  await db.delete(installationGroups).where(eq(installationGroups.id, id))
  return c.json({ ok: true })
})

// ─── POST /api/groups/:id/installations ──────────────────────────────────────

groupsRouter.post('/:id/installations', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const { installationId } = await c.req.json<{ installationId: string }>()

  await db
    .insert(installationGroupItems)
    .values({ groupId: id, installationId })
    .onConflictDoNothing()

  return c.json({ ok: true })
})

// ─── DELETE /api/groups/:id/installations/:installationId ────────────────────

groupsRouter.delete('/:id/installations/:installationId', async (c) => {
  const db = c.get('db')
  const { id, installationId } = c.req.param()

  await db
    .delete(installationGroupItems)
    .where(
      and(
        eq(installationGroupItems.groupId, id),
        eq(installationGroupItems.installationId, installationId),
      )
    )

  return c.json({ ok: true })
})
