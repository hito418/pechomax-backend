import type { Kyselify } from 'drizzle-orm/kysely'
import { catchComments } from './schemas/catchComments'
import { catchLikes } from './schemas/catchLikes'
import { catches } from './schemas/catches'
import { categories } from './schemas/categories'
import { conversations } from './schemas/conversations'
import { favoriteLocations } from './schemas/favoriteLocations'
import { levels } from './schemas/levels'
import { locationComments } from './schemas/locationComments'
import { locationRatings } from './schemas/locationRatings'
import { locations } from './schemas/locations'
import { messages } from './schemas/messages'
import { species } from './schemas/species'
import { speciesLocation } from './schemas/speciesLocation'
import { users } from './schemas/users'
import { savedCatches } from './schemas/savedCatches'

export type Database = {
  catch_comments: Kyselify<typeof catchComments>
  catch_likes: Kyselify<typeof catchLikes>
  catches: Kyselify<typeof catches>
  categories: Kyselify<typeof categories>
  conversations: Kyselify<typeof conversations>
  favorite_locations: Kyselify<typeof favoriteLocations>
  levels: Kyselify<typeof levels>
  location_comments: Kyselify<typeof locationComments>
  location_ratings: Kyselify<typeof locationRatings>
  locations: Kyselify<typeof locations>
  messages: Kyselify<typeof messages>
  species: Kyselify<typeof species>
  speciesLocation: Kyselify<typeof speciesLocation>
  saved_catches: Kyselify<typeof savedCatches>
  users: Kyselify<typeof users>
}
