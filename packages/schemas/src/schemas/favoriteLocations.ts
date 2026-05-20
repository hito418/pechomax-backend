import { relations } from 'drizzle-orm'
import { pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { locations } from './locations'
import { users } from './users'
import { timestamps } from './utils/timestamps'

export const favoriteLocations = pgTable(
  'favorite_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .references(() => locations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    userLocationUnique: uniqueIndex('favorite_locations_user_id_location_id_unique').on(
      table.userId,
      table.locationId
    ),
  })
)

export const favoriteLocationsRelations = relations(
  favoriteLocations,
  ({ one }) => ({
    location: one(locations, {
      fields: [favoriteLocations.locationId],
      references: [locations.id],
    }),
    user: one(users, {
      fields: [favoriteLocations.userId],
      references: [users.id],
    }),
  })
)

export type FavoriteLocation = typeof favoriteLocations.$inferSelect
export type FavoriteLocationInsert = typeof favoriteLocations.$inferInsert
