import { relations } from 'drizzle-orm'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { locations } from './locations'
import { users } from './users'
import { timestamps } from './utils/timestamps'

export const locationComments = pgTable('location_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  locationId: uuid('location_id')
    .references(() => locations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  ...timestamps,
})

export const locationCommentsRelations = relations(
  locationComments,
  ({ one }) => ({
    location: one(locations, {
      fields: [locationComments.locationId],
      references: [locations.id],
    }),
    user: one(users, {
      fields: [locationComments.userId],
      references: [users.id],
    }),
  })
)

export type LocationComment = typeof locationComments.$inferSelect
export type LocationCommentInsert = typeof locationComments.$inferInsert
