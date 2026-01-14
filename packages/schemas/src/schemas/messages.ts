import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { conversations } from './conversations'
import { relations } from 'drizzle-orm'
import { timestamps } from './utils/timestamps'

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  pictures: text('pictures').array().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  conversationId: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  ...timestamps,
})

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}))

export type Message = typeof messages.$inferSelect
export type MessageInsert = typeof messages.$inferInsert
