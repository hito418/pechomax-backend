import { relations } from 'drizzle-orm'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { catches } from './catches'
import { users } from './users'
import { timestamps } from './utils/timestamps'

export const catchComments = pgTable('catch_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  catchId: uuid('catch_id')
    .references(() => catches.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  ...timestamps,
})

export const catchCommentsRelations = relations(catchComments, ({ one }) => ({
  catch: one(catches, {
    fields: [catchComments.catchId],
    references: [catches.id],
  }),
  user: one(users, {
    fields: [catchComments.userId],
    references: [users.id],
  }),
}))

export type CatchComment = typeof catchComments.$inferSelect
export type CatchCommentInsert = typeof catchComments.$inferInsert
