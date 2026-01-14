import { sValidator } from '@hono/standard-validator'
import { type } from 'arktype'
import { env } from 'hono/adapter'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'

const speciesRoute = new HonoVar().basePath('/species')

speciesRoute.get(
  '/',
  sValidator('query', type({ 'page?': 'string.numeric.parse' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { page = 1 } = ctx.req.valid('query')

    const pageSize = Number(env(ctx).PAGE_SIZE)

    const speciesList = await db
      .selectFrom('species')
      .selectAll()
      .orderBy('species.updated_at desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute()

    return ctx.json(speciesList)
  }
)

speciesRoute.get(
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

    const speciesItem = await db
      .selectFrom('species')
      .selectAll()
      .where('species.id', '=', id)
      .executeTakeFirst()

    if (!speciesItem) {
      return ctx.json({ message: 'Species not found' }, 404)
    }

    return ctx.json(speciesItem)
  }
)

speciesRoute.post(
  '/create',
  isAuth('Admin'),
  sValidator(
    'json',
    type({
      name: 'string',
      pointValue: 'number',
      'locationIds?': 'string[]',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { name, pointValue, locationIds = [] } = ctx.req.valid('json')

    const speciesItem = await db
      .insertInto('species')
      .values({ name, point_value: pointValue })
      .returningAll()
      .executeTakeFirst()

    if (!speciesItem) {
      return ctx.json({ message: 'Failed to create species' }, 500)
    }

    if (locationIds.length > 0) {
      await db
        .insertInto('speciesLocation')
        .values(
          locationIds.map((locationId) => ({
            location_id: locationId,
            species_id: speciesItem.id,
          }))
        )
        .execute()
    }

    return ctx.json(speciesItem, 201)
  }
)

speciesRoute.put(
  '/update/:id',
  isAuth('Admin'),
  sValidator('param', type({ id: 'string' })),
  sValidator(
    'json',
    type({
      'name?': 'string',
      'pointValue?': 'number',
      'locationIds?': 'string[]',
      'deleteLocationIds?': 'string[]',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      locationIds = [],
      deleteLocationIds = [],
      pointValue,
      ...updateSpecies
    } = ctx.req.valid('json')

    const updatePayload: Record<string, unknown> = { ...updateSpecies }

    if (pointValue !== undefined) {
      updatePayload.point_value = pointValue
    }

    const speciesItem = await db
      .updateTable('species')
      .set(updatePayload)
      .where('species.id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!speciesItem) {
      return ctx.json({ message: 'Species not found' }, 404)
    }

    if (locationIds.length > 0) {
      await db
        .insertInto('speciesLocation')
        .values(
          locationIds.map((locationId) => ({
            location_id: locationId,
            species_id: speciesItem.id,
          }))
        )
        .execute()
    }

    if (deleteLocationIds.length > 0) {
      await db
        .deleteFrom('speciesLocation')
        .where('speciesLocation.species_id', '=', id)
        .where('speciesLocation.location_id', 'in', deleteLocationIds)
        .execute()
    }

    return ctx.json(speciesItem)
  }
)

speciesRoute.delete(
  '/delete/:id',
  isAuth('Admin'),
  sValidator('param', type({ id: 'string' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')

    const speciesItem = await db
      .deleteFrom('species')
      .where('species.id', '=', id)
      .returning('species.id')
      .executeTakeFirst()

    if (!speciesItem) {
      return ctx.json({ message: 'Species not found' }, 404)
    }

    return ctx.json({ message: 'Species deleted' })
  }
)

export default speciesRoute
