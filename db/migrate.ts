import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config({ path: '.dev.vars' })

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL is not set')

  // postgres-js uses TCP — supports multi-statement migrations (unlike neon-http)
  const client = postgres(url, { ssl: 'require', max: 1 })
  const db = drizzle(client)

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: join(__dirname, 'migrations') })
  console.log('Migrations done!')
  await client.end()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
