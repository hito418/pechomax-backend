import { relations } from 'drizzle-orm'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { catches } from './catches'
import { speciesLocation } from './speciesLocation'
import { timestamps } from './utils/timestamps'

export const species = pgTable('species', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').unique(),
  pointValue: integer('point_value').notNull(),
  ...timestamps,
})

export const speciesRlations = relations(species, ({ many }) => ({
  catches: many(catches),
  speciesLoactions: many(speciesLocation),
}))

export type Species = typeof species.$inferSelect
export type SpeciesInsert = typeof species.$inferInsert
