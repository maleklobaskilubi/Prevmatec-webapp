import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.dev.vars' })

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.NEON_DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
