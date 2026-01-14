import { sValidator } from '@hono/standard-validator'
import { type } from 'arktype'
import { env } from 'hono/adapter'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'

const locationsRoute = new HonoVar().basePath('/locations')

locationsRoute.get(
  '/',
  sValidator('query', type({ 'page?': 'string.numeric.parse' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { page = 1 } = ctx.req.valid('query')

    const pageSize = Number(env(ctx).PAGE_SIZE)

    const locationList = await db
      .selectFrom('locations')
      .selectAll()
      .orderBy('locations.updated_at desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute()

    return ctx.json(locationList)
  }
)

locationsRoute.get('/all', async (ctx) => {
  const db = ctx.get('database')

  const locationList = await db.selectFrom('locations').selectAll().execute()

  return ctx.json(locationList)
})

locationsRoute.get('/self', isAuth(), async (ctx) => {
  const db = ctx.get('database')
  const {
    sub: { id },
  } = ctx.get('userPayload')

  const locationList = await db
    .selectFrom('locations')
    .selectAll()
    .where('locations.user_id', '=', id)
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

    const locationItem = await db
      .selectFrom('locations')
      .selectAll()
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
  sValidator(
    'json',
    type({
      longitude: 'string',
      latitude: 'string',
      name: 'string',
      description: 'string',
      'speciesIds?': 'string[]',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')
    const { longitude, latitude, name, description, speciesIds = [] } =
      ctx.req.valid('json')

    const locationItem = await db
      .insertInto('locations')
      .values({ longitude, latitude, name, description, user_id: userId })
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

    return ctx.json(locationItem, 201)
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
      ...updateDatas
    } = ctx.req.valid('json')
    const {
      sub: { id: userId },
      role,
    } = ctx.get('userPayload')

    const locationQuery = db
      .updateTable('locations')
      .set(updateDatas)
      .where('locations.id', '=', id)

    if (role !== 'Admin') {
      locationQuery.where('locations.user_id', '=', userId)
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

    return ctx.json(locationItem)
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

    const deleteQuery = db
      .deleteFrom('locations')
      .where('locations.id', '=', id)

    if (role !== 'Admin') {
      deleteQuery.where('locations.user_id', '=', userId)
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
