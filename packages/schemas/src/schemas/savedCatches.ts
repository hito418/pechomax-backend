import { relations } from 'drizzle-orm'
import { pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { catches } from './catches'
import { users } from './users'
import { timestamps } from './utils/timestamps'

export const savedCatches = pgTable(
  'saved_catches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    catchId: uuid('catch_id')
      .references(() => catches.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    userCatchUnique: uniqueIndex('saved_catches_user_id_catch_id_unique').on(
      table.userId,
      table.catchId
    ),
  })
)

export const savedCatchesRelations = relations(savedCatches, ({ one }) => ({
  catch: one(catches, {
    fields: [savedCatches.catchId],
    references: [catches.id],
  }),
  user: one(users, {
    fields: [savedCatches.userId],
    references: [users.id],
  }),
}))

export type SavedCatch = typeof savedCatches.$inferSelect
export type SavedCatchInsert = typeof savedCatches.$inferInsert
