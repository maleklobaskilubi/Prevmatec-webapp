import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  date,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  identities: many(userIdentities),
  sessions: many(sessions),
  installations: many(installations),
  installationMembers: many(installationMembers),
  notes: many(installationNotes),
  visits: many(visits),
  reminders: many(reminders),
}))

// ─── OAuth Identities ─────────────────────────────────────────────────────────

export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'google'
    providerUserId: text('provider_user_id').notNull(),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerUnique: uniqueIndex('user_identities_provider_uid_idx').on(t.provider, t.providerUserId),
  })
)

export const userIdentitiesRelations = relations(userIdentities, ({ one }) => ({
  user: one(users, { fields: [userIdentities.userId], references: [users.id] }),
}))

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // random hex
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (t) => ({
    userIdx: index('sessions_user_id_idx').on(t.userId),
    expiresIdx: index('sessions_expires_at_idx').on(t.expiresAt),
  })
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

// ─── Robots ───────────────────────────────────────────────────────────────────

export const robots = pgTable('robots', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  manufacturer: text('manufacturer'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const robotsRelations = relations(robots, ({ many }) => ({
  installations: many(installations),
}))

// ─── Installations ────────────────────────────────────────────────────────────

export const installations = pgTable(
  'installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venueName: text('venue_name').notNull(),
    addressText: text('address_text').notNull(),
    lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
    lon: numeric('lon', { precision: 10, scale: 7 }).notNull(),
    managerName: text('manager_name'),
    managerContact: text('manager_contact'),
    installedAt: date('installed_at').notNull(),
    robotId: uuid('robot_id').references(() => robots.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    createdByIdx: index('installations_created_by_idx').on(t.createdBy),
    robotIdx: index('installations_robot_id_idx').on(t.robotId),
    installedAtIdx: index('installations_installed_at_idx').on(t.installedAt),
  })
)

export const installationsRelations = relations(installations, ({ one, many }) => ({
  robot: one(robots, { fields: [installations.robotId], references: [robots.id] }),
  creator: one(users, { fields: [installations.createdBy], references: [users.id] }),
  members: many(installationMembers),
  notes: many(installationNotes),
  visits: many(visits),
  reminders: many(reminders),
}))

// ─── Installation Members ─────────────────────────────────────────────────────

export const installationMembers = pgTable(
  'installation_members',
  {
    installationId: uuid('installation_id')
      .notNull()
      .references(() => installations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role'),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: uniqueIndex('installation_members_pk').on(t.installationId, t.userId),
    userIdx: index('installation_members_user_idx').on(t.userId),
  })
)

export const installationMembersRelations = relations(installationMembers, ({ one }) => ({
  installation: one(installations, {
    fields: [installationMembers.installationId],
    references: [installations.id],
  }),
  user: one(users, { fields: [installationMembers.userId], references: [users.id] }),
}))

// ─── Installation Notes ───────────────────────────────────────────────────────

export const installationNotes = pgTable(
  'installation_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    installationId: uuid('installation_id')
      .notNull()
      .references(() => installations.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    installationIdx: index('notes_installation_id_idx').on(t.installationId),
  })
)

export const installationNotesRelations = relations(installationNotes, ({ one }) => ({
  installation: one(installations, {
    fields: [installationNotes.installationId],
    references: [installations.id],
  }),
  author: one(users, { fields: [installationNotes.authorId], references: [users.id] }),
}))

// ─── Visits ───────────────────────────────────────────────────────────────────

export const visits = pgTable(
  'visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    installationId: uuid('installation_id')
      .notNull()
      .references(() => installations.id, { onDelete: 'cascade' }),
    visitedAt: date('visited_at').notNull(),
    visitedBy: uuid('visited_by')
      .notNull()
      .references(() => users.id),
    summary: text('summary').notNull(),
    nextAction: text('next_action'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    installationIdx: index('visits_installation_id_idx').on(t.installationId),
  })
)

export const visitsRelations = relations(visits, ({ one }) => ({
  installation: one(installations, {
    fields: [visits.installationId],
    references: [installations.id],
  }),
  visitor: one(users, { fields: [visits.visitedBy], references: [users.id] }),
}))

// ─── Reminders ────────────────────────────────────────────────────────────────

export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    installationId: uuid('installation_id')
      .notNull()
      .references(() => installations.id, { onDelete: 'cascade' }),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('open'), // open | done | snoozed
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  },
  (t) => ({
    installationIdx: index('reminders_installation_id_idx').on(t.installationId),
    statusIdx: index('reminders_status_idx').on(t.status),
    dueAtIdx: index('reminders_due_at_idx').on(t.dueAt),
  })
)

export const remindersRelations = relations(reminders, ({ one }) => ({
  installation: one(installations, {
    fields: [reminders.installationId],
    references: [installations.id],
  }),
  creator: one(users, { fields: [reminders.createdBy], references: [users.id] }),
}))

// ─── Geocode Cache ────────────────────────────────────────────────────────────

export const geocodeCache = pgTable(
  'geocode_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    query: text('query').notNull(),
    provider: text('provider').notNull().default('nominatim'),
    responseJson: jsonb('response_json').notNull(),
    lat: numeric('lat', { precision: 10, scale: 7 }),
    lon: numeric('lon', { precision: 10, scale: 7 }),
    displayName: text('display_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    hitCount: integer('hit_count').notNull().default(1),
  },
  (t) => ({
    queryProviderIdx: uniqueIndex('geocode_cache_query_provider_idx').on(t.query, t.provider),
  })
)
