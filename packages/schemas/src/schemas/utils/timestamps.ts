import { sql } from 'drizzle-orm'
import { timestamp } from 'drizzle-orm/pg-core'

export const timestamps = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
}

export const deletedAt = timestamp('deleted_at')
