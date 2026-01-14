import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { categories } from './categories'
import { users } from './users'
import { relations } from 'drizzle-orm'
import { messages } from './messages'
import { timestamps } from './utils/timestamps'

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  categoryId: uuid('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  ...timestamps,
})

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    category: one(categories, {
      fields: [conversations.categoryId],
      references: [categories.id],
    }),
    messages: many(messages),
  })
)

export type Conversation = typeof conversations.$inferSelect
export type ConversationInsert = typeof conversations.$inferInsert
