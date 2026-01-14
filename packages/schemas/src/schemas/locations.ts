import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { relations } from 'drizzle-orm'
import { speciesLocation } from './speciesLocation'
import { catches } from './catches'
import { timestamps } from './utils/timestamps'

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  longitude: text('longitude').unique().notNull(),
  latitude: text('latitude').unique().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  ...timestamps,
})

export const locationsRelations = relations(locations, ({ one, many }) => ({
  user: one(users, {
    fields: [locations.userId],
    references: [users.id],
  }),
  speciesLocations: many(speciesLocation),
  catches: many(catches),
}))

export type Location = typeof locations.$inferSelect
export type LocationInsert = typeof locations.$inferInsert
