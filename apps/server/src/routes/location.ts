import { sValidator } from '@hono/standard-validator'
import { type } from 'arktype'
import { env } from 'hono/adapter'
import { getSignedCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { sql } from 'kysely'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { uploadSpot } from 'src/lib/firebase'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'
import { Payload } from 'src/types/payload'

const locationsRoute = new HonoVar().basePath('/locations')

async function optionalUserId(ctx: any) {
  const { COOKIE_SECRET, JWT_SECRET } = env(ctx)
  const authorization = ctx.req.header('Authorization')
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined
  const cookieToken = bearerToken
    ? undefined
    : await getSignedCookie(ctx, COOKIE_SECRET, 'access_token')
  const token = bearerToken ?? cookieToken

  if (!token) {
    return null
  }

  try {
    const payload = (await verify(token, JWT_SECRET)) as Payload
    return payload.sub.id
  } catch {
    return null
  }
}

function locationSocialSelects(userId: string | null) {
  return [
    sql<number>`(select count(*)::int from favorite_locations where favorite_locations.location_id = locations.id)`.as(
      'favoritesCount'
    ),
    sql<number>`(select count(*)::int from location_comments where location_comments.location_id = locations.id)`.as(
      'commentsCount'
    ),
    sql<number>`(select count(*)::int from location_ratings where location_ratings.location_id = locations.id)`.as(
      'ratingsCount'
    ),
    sql<number>`coalesce((select round(avg(location_ratings.rating)::numeric, 1)::float from location_ratings where location_ratings.location_id = locations.id), 0)`.as(
      'averageRating'
    ),
    userId
      ? sql<boolean>`exists(select 1 from favorite_locations where favorite_locations.location_id = locations.id and favorite_locations.user_id = ${userId})`.as(
          'isFavoriteByMe'
        )
      : sql<boolean>`false`.as('isFavoriteByMe'),
    userId
      ? sql<number | null>`(select location_ratings.rating from location_ratings where location_ratings.location_id = locations.id and location_ratings.user_id = ${userId} limit 1)`.as(
          'myRating'
        )
      : sql<number | null>`null`.as('myRating'),
  ] as const
}

function firstBodyValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value
}

function stringBodyValue(value: unknown) {
  const first = firstBodyValue(value)
  return typeof first === 'string' ? first : undefined
}

function fileBodyValue(value: unknown) {
  const first = firstBodyValue(value)
  return first instanceof File && first.size > 0 ? first : undefined
}

function speciesIdsFromValue(value: unknown) {
  const first = firstBodyValue(value)

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }

  if (Array.isArray(first)) {
    return first.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }

  if (typeof first !== 'string' || first.trim().length === 0) {
    return []
  }

  try {
    const parsed = JSON.parse(first)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
  } catch {
    return first
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

async function parseCreateLocationRequest(ctx: any) {
  const contentType = ctx.req.header('content-type') ?? ''

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const body = await ctx.req.parseBody()
    return {
      description: stringBodyValue(body.description) ?? '',
      latitude: stringBodyValue(body.latitude),
      longitude: stringBodyValue(body.longitude),
      name: stringBodyValue(body.name),
      pictures: fileBodyValue(body.pictures ?? body.picture),
      speciesIds: speciesIdsFromValue(body.speciesIds),
      waterType: stringBodyValue(body.waterType) ?? 'freshwater',
    }
  }

  const body = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>

  return {
    description: typeof body.description === 'string' ? body.description : '',
    latitude: typeof body.latitude === 'string' ? body.latitude : undefined,
    longitude: typeof body.longitude === 'string' ? body.longitude : undefined,
    name: typeof body.name === 'string' ? body.name : undefined,
    pictures: undefined,
    speciesIds: speciesIdsFromValue(body.speciesIds),
    waterType: typeof body.waterType === 'string' ? body.waterType : 'freshwater',
  }
}

locationsRoute.get(
  '/',
  sValidator('query', type({ 'page?': 'string.numeric.parse' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { page = 1 } = ctx.req.valid('query')
    const userId = await optionalUserId(ctx)

    const pageSize = Number(env(ctx).PAGE_SIZE)

    const locationList = await db
      .selectFrom('locations')
      .selectAll('locations')
      .select((eb) => [
        ...locationSocialSelects(userId),
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .selectAll()
            .whereRef('users.id', '=', 'locations.user_id')
        ).as('user'),
        jsonArrayFrom(
          eb
            .selectFrom('speciesLocation')
            .selectAll('speciesLocation')
            .select((eb2) => [
              jsonObjectFrom(
                eb2
                  .selectFrom('species')
                  .selectAll()
                  .whereRef('species.id', '=', 'speciesLocation.species_id')
              ).as('species'),
            ])
            .whereRef('speciesLocation.location_id', '=', 'locations.id')
        ).as('speciesLocations'),
      ])
      .orderBy('locations.updated_at desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute()

    return ctx.json(locationList)
  }
)

locationsRoute.get('/all', async (ctx) => {
  const db = ctx.get('database')
  const userId = await optionalUserId(ctx)

  const locationList = await db
    .selectFrom('locations')
    .selectAll('locations')
    .select((eb) => [
      ...locationSocialSelects(userId),
      jsonObjectFrom(
        eb
          .selectFrom('users')
          .selectAll()
          .whereRef('users.id', '=', 'locations.user_id')
      ).as('user'),
      jsonArrayFrom(
        eb
          .selectFrom('speciesLocation')
          .selectAll('speciesLocation')
          .select((eb2) => [
            jsonObjectFrom(
              eb2
                .selectFrom('species')
                .selectAll()
                .whereRef('species.id', '=', 'speciesLocation.species_id')
            ).as('species'),
          ])
          .whereRef('speciesLocation.location_id', '=', 'locations.id')
      ).as('speciesLocations'),
    ])
    .execute()

  return ctx.json(locationList)
})

locationsRoute.get('/self', isAuth(), async (ctx) => {
  const db = ctx.get('database')
  const {
    sub: { id },
  } = ctx.get('userPayload')

  const locationList = await db
    .selectFrom('locations')
    .selectAll('locations')
    .select((eb) => [
      ...locationSocialSelects(id),
      jsonArrayFrom(
        eb
          .selectFrom('speciesLocation')
          .selectAll('speciesLocation')
          .select((eb2) => [
            jsonObjectFrom(
              eb2
                .selectFrom('species')
                .selectAll()
                .whereRef('species.id', '=', 'speciesLocation.species_id')
            ).as('species'),
          ])
          .whereRef('speciesLocation.location_id', '=', 'locations.id')
      ).as('speciesLocations'),
    ])
    .where('locations.user_id', '=', id)
    .execute()

  return ctx.json(locationList)
})

locationsRoute.get('/favorites/self', isAuth(), async (ctx) => {
  const db = ctx.get('database')
  const {
    sub: { id },
  } = ctx.get('userPayload')

  const locationList = await db
    .selectFrom('favorite_locations')
    .innerJoin('locations', 'locations.id', 'favorite_locations.location_id')
    .selectAll('locations')
    .select((eb) => [
      ...locationSocialSelects(id),
      jsonObjectFrom(
        eb
          .selectFrom('users')
          .selectAll()
          .whereRef('users.id', '=', 'locations.user_id')
      ).as('user'),
      jsonArrayFrom(
        eb
          .selectFrom('speciesLocation')
          .selectAll('speciesLocation')
          .select((eb2) => [
            jsonObjectFrom(
              eb2
                .selectFrom('species')
                .selectAll()
                .whereRef('species.id', '=', 'speciesLocation.species_id')
            ).as('species'),
          ])
          .whereRef('speciesLocation.location_id', '=', 'locations.id')
      ).as('speciesLocations'),
    ])
    .where('favorite_locations.user_id', '=', id)
    .orderBy('favorite_locations.created_at desc')
    .execute()

  return ctx.json(locationList)
})

locationsRoute.get(
  '/:id',
  sValidator(
    'param',
    type({
      id: 'string',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const userId = await optionalUserId(ctx)

    const locationItem = await db
      .selectFrom('locations')
      .selectAll('locations')
      .select((eb) => [
        ...locationSocialSelects(userId),
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .selectAll()
            .whereRef('users.id', '=', 'locations.user_id')
        ).as('user'),
        jsonArrayFrom(
          eb
            .selectFrom('speciesLocation')
            .selectAll('speciesLocation')
            .select((eb2) => [
              jsonObjectFrom(
                eb2
                  .selectFrom('species')
                  .selectAll()
                  .whereRef('species.id', '=', 'speciesLocation.species_id')
              ).as('species'),
            ])
            .whereRef('speciesLocation.location_id', '=', 'locations.id')
        ).as('speciesLocations'),
      ])
      .where('locations.id', '=', id)
      .executeTakeFirst()

    if (!locationItem) {
      return ctx.json({ message: 'Location not found' }, 404)
    }

    return ctx.json(locationItem)
  }
)

locationsRoute.post(
  '/create',
  isAuth(),
  async (ctx) => {
    const db = ctx.get('database')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')
    const { longitude, latitude, name, description, pictures, waterType, speciesIds } =
      await parseCreateLocationRequest(ctx)

    if (!longitude || !latitude || !name?.trim()) {
      return ctx.json({ message: 'Missing location fields' }, 400)
    }

    if (waterType !== 'freshwater' && waterType !== 'sea') {
      return ctx.json({ message: 'Invalid water type' }, 400)
    }

    if (pictures && pictures.size > Number(env(ctx).MAX_FILE_SIZE)) {
      return ctx.json({ message: 'File too large' }, 400)
    }

    const picturesUrl = pictures ? [await uploadSpot(pictures)] : []

    const locationItem = await db
      .insertInto('locations')
      .values({
        longitude,
        latitude,
        name: name.trim(),
        description,
        pictures: picturesUrl,
        water_type: waterType,
        user_id: userId,
      })
      .returningAll()
      .executeTakeFirst()

    if (!locationItem) {
      return ctx.json({ message: 'Failed to create location' }, 500)
    }

    if (speciesIds.length > 0) {
      await db
        .insertInto('speciesLocation')
        .values(
          speciesIds.map((speciesId) => ({
            species_id: speciesId,
            location_id: locationItem.id,
          }))
        )
        .execute()
    }

    const returningLocation = await db
      .selectFrom('locations')
      .selectAll('locations')
      .select((eb) => [
        ...locationSocialSelects(userId),
        jsonArrayFrom(
          eb
            .selectFrom('speciesLocation')
            .selectAll('speciesLocation')
            .select((eb2) => [
              jsonObjectFrom(
                eb2
                  .selectFrom('species')
                  .selectAll()
                  .whereRef('species.id', '=', 'speciesLocation.species_id')
              ).as('species'),
            ])
            .whereRef('speciesLocation.location_id', '=', 'locations.id')
        ).as('speciesLocations'),
      ])
      .where('locations.id', '=', locationItem.id)
      .executeTakeFirst()

    return ctx.json(returningLocation, 201)
  }
)

locationsRoute.post('/:id/favorite', isAuth(), sValidator('param', type({ id: 'string' })), async (ctx) => {
  const db = ctx.get('database')
  const { id } = ctx.req.valid('param')
  const {
    sub: { id: userId },
  } = ctx.get('userPayload')

  const location = await db.selectFrom('locations').select('id').where('id', '=', id).executeTakeFirst()

  if (!location) {
    return ctx.json({ message: 'Location not found' }, 404)
  }

  await db
    .insertInto('favorite_locations')
    .values({ location_id: id, user_id: userId })
    .onConflict((oc) => oc.columns(['user_id', 'location_id']).doNothing())
    .execute()

  return ctx.json({ favorite: true })
})

locationsRoute.delete('/:id/favorite', isAuth(), sValidator('param', type({ id: 'string' })), async (ctx) => {
  const db = ctx.get('database')
  const { id } = ctx.req.valid('param')
  const {
    sub: { id: userId },
  } = ctx.get('userPayload')

  await db.deleteFrom('favorite_locations').where('location_id', '=', id).where('user_id', '=', userId).execute()
  return ctx.json({ favorite: false })
})

locationsRoute.get('/:id/comments', sValidator('param', type({ id: 'string' })), async (ctx) => {
  const db = ctx.get('database')
  const { id } = ctx.req.valid('param')

  const location = await db.selectFrom('locations').select('id').where('id', '=', id).executeTakeFirst()

  if (!location) {
    return ctx.json({ message: 'Location not found' }, 404)
  }

  const comments = await db
    .selectFrom('location_comments')
    .selectAll('location_comments')
    .select((eb) => [
      jsonObjectFrom(
        eb
          .selectFrom('users')
          .select([
            'users.id',
            'users.username',
            'users.profile_pic',
            'users.city',
            'users.region',
            'users.score',
          ])
          .whereRef('users.id', '=', 'location_comments.user_id')
      ).as('user'),
    ])
    .where('location_id', '=', id)
    .orderBy('created_at desc')
    .execute()

  return ctx.json(comments)
})

locationsRoute.post(
  '/:id/comments',
  isAuth(),
  sValidator('param', type({ id: 'string' })),
  sValidator('json', type({ content: 'string' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const { content } = ctx.req.valid('json')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')

    if (!content.trim()) {
      return ctx.json({ message: 'Comment content is required' }, 400)
    }

    const location = await db.selectFrom('locations').select('id').where('id', '=', id).executeTakeFirst()

    if (!location) {
      return ctx.json({ message: 'Location not found' }, 404)
    }

    const comment = await db
      .insertInto('location_comments')
      .values({ content: content.trim(), location_id: id, user_id: userId })
      .returningAll()
      .executeTakeFirst()

    if (!comment) {
      return ctx.json({ message: 'Failed to create comment' }, 500)
    }

    const returningComment = await db
      .selectFrom('location_comments')
      .selectAll('location_comments')
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select([
              'users.id',
              'users.username',
              'users.profile_pic',
              'users.city',
              'users.region',
              'users.score',
            ])
            .whereRef('users.id', '=', 'location_comments.user_id')
        ).as('user'),
      ])
      .where('location_comments.id', '=', comment.id)
      .executeTakeFirst()

    return ctx.json(returningComment, 201)
  }
)

locationsRoute.get('/:id/rating-summary', sValidator('param', type({ id: 'string' })), async (ctx) => {
  const db = ctx.get('database')
  const { id } = ctx.req.valid('param')
  const userId = await optionalUserId(ctx)

  const location = await db.selectFrom('locations').select('id').where('id', '=', id).executeTakeFirst()

  if (!location) {
    return ctx.json({ message: 'Location not found' }, 404)
  }

  const summary = await db
    .selectFrom('locations')
    .select([
      sql<number>`coalesce((select round(avg(location_ratings.rating)::numeric, 1)::float from location_ratings where location_ratings.location_id = locations.id), 0)`.as(
        'averageRating'
      ),
      sql<number>`(select count(*)::int from location_ratings where location_ratings.location_id = locations.id)`.as(
        'ratingsCount'
      ),
      userId
        ? sql<number | null>`(select location_ratings.rating from location_ratings where location_ratings.location_id = locations.id and location_ratings.user_id = ${userId} limit 1)`.as(
            'myRating'
          )
        : sql<number | null>`null`.as('myRating'),
    ])
    .where('locations.id', '=', id)
    .executeTakeFirst()

  return ctx.json(summary)
})

locationsRoute.post(
  '/:id/rating',
  isAuth(),
  sValidator('param', type({ id: 'string' })),
  sValidator('json', type({ rating: 'number' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const { rating } = ctx.req.valid('json')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return ctx.json({ message: 'Rating must be between 1 and 5' }, 400)
    }

    const location = await db.selectFrom('locations').select('id').where('id', '=', id).executeTakeFirst()

    if (!location) {
      return ctx.json({ message: 'Location not found' }, 404)
    }

    await db
      .insertInto('location_ratings')
      .values({ location_id: id, rating, user_id: userId })
      .onConflict((oc) =>
        oc.columns(['user_id', 'location_id']).doUpdateSet({
          rating,
          updated_at: new Date(),
        })
      )
      .execute()

    const summary = await db
      .selectFrom('locations')
      .select([
        sql<number>`coalesce((select round(avg(location_ratings.rating)::numeric, 1)::float from location_ratings where location_ratings.location_id = locations.id), 0)`.as(
          'averageRating'
        ),
        sql<number>`(select count(*)::int from location_ratings where location_ratings.location_id = locations.id)`.as(
          'ratingsCount'
        ),
        sql<number | null>`(select location_ratings.rating from location_ratings where location_ratings.location_id = locations.id and location_ratings.user_id = ${userId} limit 1)`.as(
          'myRating'
        ),
      ])
      .where('locations.id', '=', id)
      .executeTakeFirst()

    return ctx.json(summary)
  }
)

locationsRoute.put(
  '/update/:id',
  isAuth(),
  sValidator('param', type({ id: 'string' })),
  sValidator(
    'json',
    type({
      'longitude?': 'string',
      'latitude?': 'string',
      'name?': 'string',
      'description?': 'string | null',
      'waterType?': "'freshwater' | 'sea'",
      'speciesIds?': 'string[]',
      'deleteSpeciesIds?': 'string[]',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      speciesIds = [],
      deleteSpeciesIds = [],
      waterType,
      ...updateDatas
    } = ctx.req.valid('json')
    const {
      sub: { id: userId },
      role,
    } = ctx.get('userPayload')

    const updatePayload: Record<string, unknown> = { ...updateDatas }

    if (waterType !== undefined) {
      updatePayload.water_type = waterType
    }

    let locationQuery = db
      .updateTable('locations')
      .set(updatePayload)
      .where('locations.id', '=', id)

    if (role !== 'Admin') {
      locationQuery = locationQuery.where('locations.user_id', '=', userId)
    }

    const locationItem = await locationQuery
      .returningAll()
      .executeTakeFirst()

    if (!locationItem) {
      return ctx.json({ message: 'Location not found' }, 404)
    }

    if (speciesIds.length > 0) {
      await db
        .insertInto('speciesLocation')
        .values(
          speciesIds.map((speciesId) => ({
            species_id: speciesId,
            location_id: locationItem.id,
          }))
        )
        .execute()
    }

    if (deleteSpeciesIds.length > 0) {
      await db
        .deleteFrom('speciesLocation')
        .where('speciesLocation.location_id', '=', locationItem.id)
        .where('speciesLocation.species_id', 'in', deleteSpeciesIds)
        .execute()
    }

    const returningLocation = await db
      .selectFrom('locations')
      .selectAll('locations')
      .select((eb) => [
        ...locationSocialSelects(userId),
        jsonArrayFrom(
          eb
            .selectFrom('speciesLocation')
            .selectAll('speciesLocation')
            .select((eb2) => [
              jsonObjectFrom(
                eb2
                  .selectFrom('species')
                  .selectAll()
                  .whereRef('species.id', '=', 'speciesLocation.species_id')
              ).as('species'),
            ])
            .whereRef('speciesLocation.location_id', '=', 'locations.id')
        ).as('speciesLocations'),
      ])
      .where('locations.id', '=', locationItem.id)
      .executeTakeFirst()

    return ctx.json(returningLocation)
  }
)

locationsRoute.delete(
  '/delete/:id',
  isAuth(),
  sValidator('param', type({ id: 'string' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      sub: { id: userId },
      role,
    } = ctx.get('userPayload')

    let deleteQuery = db
      .deleteFrom('locations')
      .where('locations.id', '=', id)

    if (role !== 'Admin') {
      deleteQuery = deleteQuery.where('locations.user_id', '=', userId)
    }

    const deletedLocation = await deleteQuery
      .returning('locations.id')
      .executeTakeFirst()

    if (!deletedLocation) {
      return ctx.json({ message: 'Location not found' }, 404)
    }

    return ctx.json({ message: 'Location deleted' })
  }
)

export default locationsRoute
