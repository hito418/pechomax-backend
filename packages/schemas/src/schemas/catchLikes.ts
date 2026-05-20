import { relations } from 'drizzle-orm'
import { pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { catches } from './catches'
import { users } from './users'
import { timestamps } from './utils/timestamps'

export const catchLikes = pgTable(
  'catch_likes',
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
    userCatchUnique: uniqueIndex('catch_likes_user_id_catch_id_unique').on(
      table.userId,
      table.catchId
    ),
  })
)

export const catchLikesRelations = relations(catchLikes, ({ one }) => ({
  catch: one(catches, {
    fields: [catchLikes.catchId],
    references: [catches.id],
  }),
  user: one(users, {
    fields: [catchLikes.userId],
    references: [users.id],
  }),
}))

export type CatchLike = typeof catchLikes.$inferSelect
export type CatchLikeInsert = typeof catchLikes.$inferInsert
