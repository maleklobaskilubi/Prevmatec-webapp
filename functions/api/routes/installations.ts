import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { and, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import {
  installations,
  installationMembers,
  installationNotes,
  visits,
  reminders,
  robots,
  users,
  installationGroups,
  installationGroupItems,
} from '../../../db/schema'
import { requireAuth } from '../lib/session'
import {
  CreateInstallationSchema,
  PatchInstallationSchema,
  InstallationFiltersSchema,
  AddMemberSchema,
  CreateNoteSchema,
  CreateVisitSchema,
  CreateReminderSchema,
} from '../../../shared/schemas'
import type { AppContext } from '../types'

export const installationsRouter = new Hono<AppContext>()

installationsRouter.use('*', requireAuth)

// ─── GET /api/installations ───────────────────────────────────────────────────

installationsRouter.get('/', zValidator('query', InstallationFiltersSchema), async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const q = c.req.valid('query')

  const page = Math.max(1, parseInt(q.page ?? '1'))
  const limit = Math.min(100, parseInt(q.limit ?? '50'))
  const offset = (page - 1) * limit

  const conditions = []

  // mine filter: use EXISTS subquery — no extra round-trip
  if (q.mine === 'true') {
    conditions.push(
      or(
        eq(installations.createdBy, userId),
        sql`EXISTS (
          SELECT 1 FROM installation_members im
          WHERE im.installation_id = ${installations.id}
            AND im.user_id = ${userId}
        )`
      )
    )
  }

  if (q.createdBy) conditions.push(eq(installations.createdBy, q.createdBy))
  if (q.robotId) conditions.push(eq(installations.robotId, q.robotId))
  if (q.dateFrom) conditions.push(gte(installations.installedAt, q.dateFrom))
  if (q.dateTo) conditions.push(lte(installations.installedAt, q.dateTo))
  if (q.text) {
    conditions.push(
      or(
        ilike(installations.venueName, `%${q.text}%`),
        ilike(installations.addressText, `%${q.text}%`),
        ilike(installations.managerName, `%${q.text}%`)
      )
    )
  }
  // has_open_reminders — push into SQL, not post-filter
  if (q.hasOpenReminders === 'true') {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM reminders r
        WHERE r.installation_id = ${installations.id}
          AND r.status = 'open'
      )`
    )
  }

  if (q.groupId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM installation_group_items gi
        WHERE gi.installation_id = ${installations.id}
          AND gi.group_id = ${q.groupId}
      )`
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Single query: main data + counts as inline subqueries + total via window function
  const rows = await db
    .select({
      id: installations.id,
      venueName: installations.venueName,
      addressText: installations.addressText,
      lat: installations.lat,
      lon: installations.lon,
      installedAt: installations.installedAt,
      robotId: installations.robotId,
      createdBy: installations.createdBy,
      createdAt: installations.createdAt,
      updatedAt: installations.updatedAt,
      robotName: robots.name,
      creatorName: users.name,
      creatorEmail: users.email,
      openReminderCount: sql<number>`(
        SELECT COUNT(*)::int FROM reminders r
        WHERE r.installation_id = ${installations.id} AND r.status = 'open'
      )`,
      memberCount: sql<number>`(
        SELECT COUNT(*)::int FROM installation_members im
        WHERE im.installation_id = ${installations.id}
      )`,
      groups: sql<{id: string; name: string; color: string}[]>`COALESCE((
        SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color) ORDER BY g.name)
        FROM installation_group_items gi
        JOIN installation_groups g ON g.id = gi.group_id
        WHERE gi.installation_id = ${installations.id}
      ), '[]'::json)`,
      total: sql<number>`COUNT(*) OVER ()`,
    })
    .from(installations)
    .leftJoin(robots, eq(installations.robotId, robots.id))
    .leftJoin(users, eq(installations.createdBy, users.id))
    .where(whereClause)
    .orderBy(sql`${installations.installedAt} DESC`)
    .limit(limit)
    .offset(offset)

  const total = rows[0]?.total ?? 0

  const data = rows.map((r) => ({
    id: r.id,
    venueName: r.venueName,
    addressText: r.addressText,
    lat: parseFloat(r.lat as unknown as string),
    lon: parseFloat(r.lon as unknown as string),
    installedAt: r.installedAt,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    robot: r.robotId ? { id: r.robotId, name: r.robotName } : null,
    creator: { id: r.createdBy, name: r.creatorName, email: r.creatorEmail },
    openReminderCount: r.openReminderCount ?? 0,
    memberCount: r.memberCount ?? 0,
    groups: r.groups ?? [],
  }))

  return c.json({ data, total, page, limit })
})

// ─── POST /api/installations ──────────────────────────────────────────────────

installationsRouter.post('/', zValidator('json', CreateInstallationSchema), async (c) => {
  const body = c.req.valid('json')
  const userId = c.get('userId')!
  const db = c.get('db')

  const [installation] = await db
    .insert(installations)
    .values({
      venueName: body.venueName,
      addressText: body.addressText,
      lat: String(body.lat),
      lon: String(body.lon),
      managerName: body.managerName,
      managerContact: body.managerContact,
      installedAt: body.installedAt,
      robotId: body.robotId,
      createdBy: userId,
    })
    .returning()

  return c.json({ ...installation, lat: parseFloat(installation.lat as unknown as string), lon: parseFloat(installation.lon as unknown as string) }, 201)
})

// ─── GET /api/installations/:id ───────────────────────────────────────────────

installationsRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const [row] = await db
    .select({
      id: installations.id,
      venueName: installations.venueName,
      addressText: installations.addressText,
      lat: installations.lat,
      lon: installations.lon,
      managerName: installations.managerName,
      managerContact: installations.managerContact,
      installedAt: installations.installedAt,
      robotId: installations.robotId,
      createdBy: installations.createdBy,
      createdAt: installations.createdAt,
      updatedAt: installations.updatedAt,
      robotName: robots.name,
      robotManufacturer: robots.manufacturer,
      creatorName: users.name,
      creatorEmail: users.email,
    })
    .from(installations)
    .leftJoin(robots, eq(installations.robotId, robots.id))
    .leftJoin(users, eq(installations.createdBy, users.id))
    .where(eq(installations.id, id))
    .limit(1)

  if (!row) return c.json({ error: 'Not found' }, 404)

  const members = await db
    .select({
      userId: installationMembers.userId,
      role: installationMembers.role,
      addedAt: installationMembers.addedAt,
      name: users.name,
      email: users.email,
    })
    .from(installationMembers)
    .leftJoin(users, eq(installationMembers.userId, users.id))
    .where(eq(installationMembers.installationId, id))

  const groups = await db
    .select({
      id: installationGroups.id,
      name: installationGroups.name,
      color: installationGroups.color,
    })
    .from(installationGroupItems)
    .innerJoin(installationGroups, eq(installationGroupItems.groupId, installationGroups.id))
    .where(eq(installationGroupItems.installationId, id))

  return c.json({
    ...row,
    lat: parseFloat(row.lat as unknown as string),
    lon: parseFloat(row.lon as unknown as string),
    robot: row.robotId
      ? { id: row.robotId, name: row.robotName, manufacturer: row.robotManufacturer }
      : null,
    creator: { id: row.createdBy, name: row.creatorName, email: row.creatorEmail },
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      addedAt: m.addedAt,
      user: { id: m.userId, name: m.name, email: m.email },
    })),
    groups,
  })
})

// ─── PATCH /api/installations/:id ─────────────────────────────────────────────

installationsRouter.patch('/:id', zValidator('json', PatchInstallationSchema), async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const { id } = c.req.param()
  const body = c.req.valid('json')

  const [existing] = await db
    .select({ createdBy: installations.createdBy })
    .from(installations)
    .where(eq(installations.id, id))
    .limit(1)

  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.createdBy !== userId) return c.json({ error: 'Forbidden' }, 403)

  const updateData: Partial<typeof installations.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (body.venueName !== undefined) updateData.venueName = body.venueName
  if (body.addressText !== undefined) updateData.addressText = body.addressText
  if (body.lat !== undefined) updateData.lat = String(body.lat)
  if (body.lon !== undefined) updateData.lon = String(body.lon)
  if (body.managerName !== undefined) updateData.managerName = body.managerName
  if (body.managerContact !== undefined) updateData.managerContact = body.managerContact
  if (body.installedAt !== undefined) updateData.installedAt = body.installedAt
  if (body.robotId !== undefined) updateData.robotId = body.robotId

  const [updated] = await db
    .update(installations)
    .set(updateData)
    .where(eq(installations.id, id))
    .returning()

  return c.json({ ...updated, lat: parseFloat(updated.lat as unknown as string), lon: parseFloat(updated.lon as unknown as string) })
})

// ─── DELETE /api/installations/:id ───────────────────────────────────────────

installationsRouter.delete('/:id', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const { id } = c.req.param()

  const [existing] = await db
    .select({ createdBy: installations.createdBy })
    .from(installations)
    .where(eq(installations.id, id))
    .limit(1)

  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.createdBy !== userId) return c.json({ error: 'Forbidden' }, 403)

  await db.delete(installations).where(eq(installations.id, id))

  return c.json({ ok: true })
})

// ─── POST /api/installations/:id/members ─────────────────────────────────────

installationsRouter.post('/:id/members', zValidator('json', AddMemberSchema), async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const { id } = c.req.param()
  const { userId: targetUserId, role } = c.req.valid('json')

  const [installation] = await db
    .select({ createdBy: installations.createdBy })
    .from(installations)
    .where(eq(installations.id, id))
    .limit(1)

  if (!installation) return c.json({ error: 'Not found' }, 404)
  if (installation.createdBy !== userId) return c.json({ error: 'Forbidden' }, 403)

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)

  if (!targetUser) return c.json({ error: 'Používateľ neexistuje' }, 404)

  await db
    .insert(installationMembers)
    .values({ installationId: id, userId: targetUser.id, role: role ?? null })
    .onConflictDoNothing()

  return c.json({ ok: true })
})

// ─── DELETE /api/installations/:id/members/:userId ────────────────────────────

installationsRouter.delete('/:id/members/:memberId', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const { id, memberId } = c.req.param()

  const [installation] = await db
    .select({ createdBy: installations.createdBy })
    .from(installations)
    .where(eq(installations.id, id))
    .limit(1)

  if (!installation) return c.json({ error: 'Not found' }, 404)
  if (installation.createdBy !== userId) return c.json({ error: 'Forbidden' }, 403)

  await db
    .delete(installationMembers)
    .where(
      and(
        eq(installationMembers.installationId, id),
        eq(installationMembers.userId, memberId)
      )
    )

  return c.json({ ok: true })
})

// ─── Notes ────────────────────────────────────────────────────────────────────

installationsRouter.get('/:id/notes', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const notes = await db
    .select({
      id: installationNotes.id,
      text: installationNotes.text,
      createdAt: installationNotes.createdAt,
      authorId: installationNotes.authorId,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(installationNotes)
    .leftJoin(users, eq(installationNotes.authorId, users.id))
    .where(eq(installationNotes.installationId, id))
    .orderBy(sql`${installationNotes.createdAt} DESC`)

  return c.json(
    notes.map((n) => ({
      ...n,
      author: { id: n.authorId, name: n.authorName, email: n.authorEmail },
    }))
  )
})

installationsRouter.post('/:id/notes', zValidator('json', CreateNoteSchema), async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const { id } = c.req.param()
  const { text } = c.req.valid('json')

  const [note] = await db
    .insert(installationNotes)
    .values({ installationId: id, authorId: userId, text })
    .returning()

  return c.json(note, 201)
})

// ─── Visits ───────────────────────────────────────────────────────────────────

installationsRouter.get('/:id/visits', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const rows = await db
    .select({
      id: visits.id,
      visitedAt: visits.visitedAt,
      summary: visits.summary,
      nextAction: visits.nextAction,
      createdAt: visits.createdAt,
      visitedBy: visits.visitedBy,
      visitorName: users.name,
    })
    .from(visits)
    .leftJoin(users, eq(visits.visitedBy, users.id))
    .where(eq(visits.installationId, id))
    .orderBy(sql`${visits.visitedAt} DESC`)

  return c.json(
    rows.map((r) => ({
      ...r,
      visitor: { id: r.visitedBy, name: r.visitorName },
    }))
  )
})

installationsRouter.post('/:id/visits', zValidator('json', CreateVisitSchema), async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const { id } = c.req.param()
  const body = c.req.valid('json')

  const [visit] = await db
    .insert(visits)
    .values({
      installationId: id,
      visitedBy: userId,
      visitedAt: body.visitedAt,
      summary: body.summary,
      nextAction: body.nextAction,
    })
    .returning()

  return c.json(visit, 201)
})

// ─── Reminders ────────────────────────────────────────────────────────────────

installationsRouter.get('/:id/reminders', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const rows = await db
    .select({
      id: reminders.id,
      dueAt: reminders.dueAt,
      reason: reminders.reason,
      status: reminders.status,
      createdAt: reminders.createdAt,
      doneAt: reminders.doneAt,
      snoozedUntil: reminders.snoozedUntil,
      createdBy: reminders.createdBy,
      creatorName: users.name,
    })
    .from(reminders)
    .leftJoin(users, eq(reminders.createdBy, users.id))
    .where(eq(reminders.installationId, id))
    .orderBy(reminders.dueAt)

  return c.json(
    rows.map((r) => ({
      ...r,
      creator: { id: r.createdBy, name: r.creatorName },
    }))
  )
})

installationsRouter.post('/:id/reminders', zValidator('json', CreateReminderSchema), async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')!
  const { id } = c.req.param()
  const { dueAt, reason } = c.req.valid('json')

  const [reminder] = await db
    .insert(reminders)
    .values({
      installationId: id,
      createdBy: userId,
      dueAt: new Date(dueAt),
      reason,
      status: 'open',
    })
    .returning()

  return c.json(reminder, 201)
})
