import { z } from 'zod'

// ─── Auth ────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Heslo musí mať aspoň 8 znakov'),
  name: z.string().min(1, 'Meno je povinné'),
  inviteCode: z.string().min(1, 'Pozvánkový kód je povinný'),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const GoogleInviteSchema = z.object({
  inviteCode: z.string().min(1),
  pendingToken: z.string().min(1),
})

// ─── Robot ───────────────────────────────────────────────────────────────────

export const CreateRobotSchema = z.object({
  name: z.string().min(1, 'Názov/model je povinný'),
  manufacturer: z.string().optional(),
  notes: z.string().optional(),
})

// ─── Installation ─────────────────────────────────────────────────────────────

export const CreateInstallationSchema = z.object({
  venueName: z.string().min(1, 'Názov prevádzky je povinný'),
  addressText: z.string().min(1, 'Adresa je povinná'),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  managerName: z.string().optional(),
  managerContact: z.string().optional(),
  installedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dátum vo formáte YYYY-MM-DD'),
  robotId: z.string().uuid().optional(),
})

export const PatchInstallationSchema = CreateInstallationSchema.partial()

export const InstallationFiltersSchema = z.object({
  mine: z.string().optional(),         // 'true'
  createdBy: z.string().optional(),
  robotId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  text: z.string().optional(),
  hasOpenReminders: z.string().optional(), // 'true'
  page: z.string().optional(),
  limit: z.string().optional(),
})

// ─── Member ───────────────────────────────────────────────────────────────────

export const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.string().optional(),
})

// ─── Note ────────────────────────────────────────────────────────────────────

export const CreateNoteSchema = z.object({
  text: z.string().min(1),
})

// ─── Visit ───────────────────────────────────────────────────────────────────

export const CreateVisitSchema = z.object({
  visitedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().min(1),
  nextAction: z.string().optional(),
})

// ─── Reminder ────────────────────────────────────────────────────────────────

export const CreateReminderSchema = z.object({
  dueAt: z.string().datetime(),
  reason: z.string().min(1),
})

export const PatchReminderSchema = z.object({
  status: z.enum(['open', 'done', 'snoozed']),
  snoozedUntil: z.string().datetime().optional(),
})

// ─── Geocode ─────────────────────────────────────────────────────────────────

export const GeocodeQuerySchema = z.object({
  q: z.string().min(1),
})

export const ReverseGeocodeQuerySchema = z.object({
  lat: z.string(),
  lon: z.string(),
})
