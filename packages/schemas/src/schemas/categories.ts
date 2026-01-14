import { relations } from 'drizzle-orm'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { conversations } from './conversations'
import { timestamps } from './utils/timestamps'

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').unique().notNull(),
  ...timestamps,
})

export const categoriesRelations = relations(categories, ({ many }) => ({
  conversations: many(conversations),
}))

export type Category = typeof categories.$inferSelect
export type CategoryInsert = typeof categories.$inferInsert
