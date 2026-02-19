import type { z } from 'zod'
import type {
  RegisterSchema,
  LoginSchema,
  CreateInstallationSchema,
  PatchInstallationSchema,
  CreateRobotSchema,
  CreateNoteSchema,
  CreateVisitSchema,
  CreateReminderSchema,
  PatchReminderSchema,
  AddMemberSchema,
} from './schemas'

// ─── Inferred from Zod ────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type CreateInstallationInput = z.infer<typeof CreateInstallationSchema>
export type PatchInstallationInput = z.infer<typeof PatchInstallationSchema>
export type CreateRobotInput = z.infer<typeof CreateRobotSchema>
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>
export type CreateVisitInput = z.infer<typeof CreateVisitSchema>
export type CreateReminderInput = z.infer<typeof CreateReminderSchema>
export type PatchReminderInput = z.infer<typeof PatchReminderSchema>
export type AddMemberInput = z.infer<typeof AddMemberSchema>

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiUser {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface ApiRobot {
  id: string
  name: string
  manufacturer: string | null
  notes: string | null
}

export interface ApiInstallation {
  id: string
  venueName: string
  addressText: string
  lat: number
  lon: number
  managerName: string | null
  managerContact: string | null
  installedAt: string
  robotId: string | null
  robot: ApiRobot | null
  createdBy: string
  creator: ApiUser
  createdAt: string
  updatedAt: string
  memberCount: number
  openReminderCount: number
}

export interface ApiInstallationDetail extends ApiInstallation {
  members: ApiMember[]
}

export interface ApiMember {
  userId: string
  user: ApiUser
  role: string | null
  addedAt: string
}

export interface ApiNote {
  id: string
  installationId: string
  authorId: string
  author: ApiUser
  text: string
  createdAt: string
}

export interface ApiVisit {
  id: string
  installationId: string
  visitedAt: string
  visitedBy: string
  visitor: ApiUser
  summary: string
  nextAction: string | null
  createdAt: string
}

export interface ApiReminder {
  id: string
  installationId: string
  dueAt: string
  reason: string
  status: 'open' | 'done' | 'snoozed'
  createdBy: string
  creator: ApiUser
  createdAt: string
  doneAt: string | null
  installation?: Pick<ApiInstallation, 'id' | 'venueName' | 'addressText'>
}

export interface GeocodeResult {
  displayName: string
  lat: number
  lon: number
  placeId: number
  type: string
  importance: number
}

export interface ApiError {
  error: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ─── GeoJSON for map ─────────────────────────────────────────────────────────

export interface InstallationGeoFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    id: string
    venueName: string
    addressText: string
    installedAt: string
    robotName: string | null
    groups?: Array<{ id: string; name: string; color: string }>
  }
}
