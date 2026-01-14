import { sValidator } from '@hono/standard-validator'
import { type } from 'arktype'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'

const speciesLocationRoute = new HonoVar()
  .basePath('/speciesLocation')
  .use(isAuth('Admin'))

speciesLocationRoute.get('/', async (ctx) => {
  const db = ctx.get('database')

  const speciesLocationList = await db
    .selectFrom('speciesLocation')
    .selectAll()
    .execute()

  return ctx.json(speciesLocationList)
})

speciesLocationRoute.get(
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

    const speciesLocationItem = await db
      .selectFrom('speciesLocation')
      .selectAll()
      .where('speciesLocation.id', '=', id)
      .executeTakeFirst()

    if (!speciesLocationItem) {
      return ctx.json({ message: 'SpeciesLocation not found' }, 404)
    }

    return ctx.json(speciesLocationItem)
  }
)

speciesLocationRoute.post(
  '/create',
  sValidator(
    'json',
    type({
      speciesId: 'string',
      locationId: 'string',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { speciesId, locationId } = ctx.req.valid('json')

    const speciesLocationItem = await db
      .insertInto('speciesLocation')
      .values({ species_id: speciesId, location_id: locationId })
      .returningAll()
      .executeTakeFirst()

    if (!speciesLocationItem) {
      return ctx.json({ message: 'Failed to create speciesLocation' }, 500)
    }

    return ctx.json(speciesLocationItem, 201)
  }
)

speciesLocationRoute.put(
  '/update/:id',
  sValidator('param', type({ id: 'string' })),
  sValidator(
    'json',
    type({
      'speciesId?': 'string',
      'locationId?': 'string',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const { speciesId, locationId } = ctx.req.valid('json')

    const updatePayload: Record<string, unknown> = {}

    if (speciesId !== undefined) {
      updatePayload.species_id = speciesId
    }

    if (locationId !== undefined) {
      updatePayload.location_id = locationId
    }

    const speciesLocationItem = await db
      .updateTable('speciesLocation')
      .set(updatePayload)
      .where('speciesLocation.id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!speciesLocationItem) {
      return ctx.json({ message: 'SpeciesLocation not found' }, 404)
    }

    return ctx.json(speciesLocationItem)
  }
)

speciesLocationRoute.delete(
  '/delete/:id',
  sValidator('param', type({ id: 'string' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')

    const speciesLocationItem = await db
      .deleteFrom('speciesLocation')
      .where('speciesLocation.id', '=', id)
      .returning('speciesLocation.id')
      .executeTakeFirst()

    if (!speciesLocationItem) {
      return ctx.json({ message: 'SpeciesLocation not found' }, 404)
    }

    return ctx.json(speciesLocationItem)
  }
)

export default speciesLocationRoute
