import { Kysely, PostgresDialect } from 'kysely'
import pkg from 'pg'
import type { Database } from '@repo/schemas'

const { Pool } = pkg

const dialect = new PostgresDialect({
  pool: new Pool({
    database: process.env.PG_DB,
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    port: parseInt(process.env.PG_PORT, 10),
    max: 10,
  }),
})

export const db = new Kysely<Database>({
  dialect,
})
