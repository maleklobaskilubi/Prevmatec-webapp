import type { Db } from '../../db/client'

export interface Env {
  NEON_DATABASE_URL: string
  SESSION_SECRET: string
  INVITE_CODE: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  APP_ORIGIN: string
  TILE_URL?: string
}

export interface Variables {
  db: Db
  userId?: string
}

export type AppContext = {
  Bindings: Env
  Variables: Variables
}
