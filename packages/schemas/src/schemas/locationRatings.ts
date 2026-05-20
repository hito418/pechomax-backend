import { relations } from 'drizzle-orm'
import { integer, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { locations } from './locations'
import { users } from './users'
import { timestamps } from './utils/timestamps'

export const locationRatings = pgTable(
  'location_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .references(() => locations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    rating: integer('rating').notNull(),
    ...timestamps,
  },
  (table) => ({
    userLocationUnique: uniqueIndex('location_ratings_user_id_location_id_unique').on(
      table.userId,
      table.locationId
    ),
  })
)

export const locationRatingsRelations = relations(locationRatings, ({ one }) => ({
  location: one(locations, {
    fields: [locationRatings.locationId],
    references: [locations.id],
  }),
  user: one(users, {
    fields: [locationRatings.userId],
    references: [users.id],
  }),
}))

export type LocationRating = typeof locationRatings.$inferSelect
export type LocationRatingInsert = typeof locationRatings.$inferInsert
