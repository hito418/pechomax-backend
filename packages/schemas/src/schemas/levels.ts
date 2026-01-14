import { relations } from 'drizzle-orm'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { timestamps } from './utils/timestamps'

export const levels = pgTable('levels', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').unique().notNull(),
  value: integer('value').unique().notNull(),
  start: integer('start').notNull(),
  end: integer('end'),
  ...timestamps,
})

export const levelsRelations = relations(levels, ({ many }) => ({
  users: many(users),
}))

export type Level = typeof levels.$inferSelect
export type LevelInsert = typeof levels.$inferInsert
