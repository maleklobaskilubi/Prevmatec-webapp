import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { reminders } from '../../../db/schema'
import { requireAuth } from '../lib/session'
import { PatchReminderSchema } from '../../../shared/schemas'
import type { AppContext } from '../types'

export const remindersRouter = new Hono<AppContext>()

remindersRouter.use('*', requireAuth)

// PATCH /api/reminders/:id
remindersRouter.patch('/:id', zValidator('json', PatchReminderSchema), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const body = c.req.valid('json')

  const [existing] = await db
    .select({ id: reminders.id })
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1)

  if (!existing) return c.json({ error: 'Not found' }, 404)

  const updateData: Partial<typeof reminders.$inferInsert> = {
    status: body.status,
  }

  if (body.status === 'done') {
    updateData.doneAt = new Date()
  }
  if (body.status === 'snoozed' && body.snoozedUntil) {
    updateData.snoozedUntil = new Date(body.snoozedUntil)
  }

  const [updated] = await db
    .update(reminders)
    .set(updateData)
    .where(eq(reminders.id, id))
    .returning()

  return c.json(updated)
})
