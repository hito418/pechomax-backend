import { sValidator } from '@hono/standard-validator'
import { type } from 'arktype'
import { env } from 'hono/adapter'
import { uploadCatch } from 'src/lib/firebase'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'

const catchesRoute = new HonoVar()
  .basePath('/catches')
  .get(
    '/',
    sValidator('query', type({ 'page?': 'string.numeric.parse' })),
    async (ctx) => {
      const db = ctx.get('database')
      const { page = 1 } = ctx.req.valid('query')

      const pageSize = Number(env(ctx).PAGE_SIZE)

      const catchList = await db
        .selectFrom('catches')
        .selectAll()
        .leftJoin('users', 'catches.user_id', 'users.id')
        .leftJoin('species', 'catches.species_id', 'species.id')
        .leftJoin('locations', 'catches.location_id', 'locations.id')
        .orderBy('catches.updated_at desc')
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute()

      return ctx.json(catchList)
    }
  )
  .get('/self', isAuth(), async (ctx) => {
    const db = ctx.get('database')
    const {
      sub: { id },
    } = ctx.get('userPayload')

    const catchList = await db
      .selectFrom('catches')
      .selectAll()
      .leftJoin('species', 'catches.species_id', 'species.id')
      .leftJoin('locations', 'catches.location_id', 'locations.id')
      .where('catches.user_id', '=', id)
      .execute()

    return ctx.json(catchList)
  })

  .get('/:id', sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')

    const catchItem = await db
      .selectFrom('catches')
      .selectAll()
      .leftJoin('users', 'catches.user_id', 'users.id')
      .leftJoin('species', 'catches.species_id', 'species.id')
      .leftJoin('locations', 'catches.location_id', 'locations.id')
      .where('catches.id', '=', id)
      .executeTakeFirst()

    if (!catchItem) {
      return ctx.json({ message: 'Catch not found' }, 404)
    }

    return ctx.json(catchItem)
  })
  .post(
    '/create',
    isAuth(),
    sValidator(
      'form',
      type({
        length: 'string.numeric.parse',
        weight: 'string.numeric.parse',
        speciesId: 'string',
        locationId: 'string',
        description: 'string',
        date: 'string.date.parse',
        pictures: 'File',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const {
        date,
        description,
        length,
        locationId,
        speciesId,
        weight,
        pictures,
      } = ctx.req.valid('form')
      const {
        sub: { id, score },
      } = ctx.get('userPayload')

      const species = await db
        .selectFrom('species')
        .select(['id', 'point_value'])
        .where('id', '=', speciesId)
        .executeTakeFirst()

      if (!species) {
        return ctx.json({ message: 'Species not found' }, 404)
      }

      if (pictures && pictures.size > Number(env(ctx).MAX_FILE_SIZE)) {
        return ctx.json({ message: 'File too large' }, 400)
      }

      const picturesUrl = pictures ? [await uploadCatch(pictures)] : []

      const catchItem = await db
        .insertInto('catches')
        .values({
          date: date.toISOString(),
          length,
          weight,
          location_id: locationId,
          pictures: picturesUrl,
          point_value: species.point_value * length * weight,
          user_id: id,
          description,
          species_id: speciesId,
        })
        .returningAll()
        .executeTakeFirst()

      if (!catchItem) {
        return ctx.json({ message: 'Failed to create catch' }, 500)
      }

      const newLevel = await db
        .selectFrom('levels')
        .selectAll()
        .where((eb) =>
          eb.or([
            eb.and([
              eb('start', '>=', score ?? 0 + catchItem.point_value),
              eb('end', '<', score ?? 0 + catchItem.point_value),
            ]),
            eb('end', 'is', null),
          ])
        )
        .orderBy('value asc')
        .executeTakeFirst()

      await db
        .updateTable('users')
        .set((eb) => ({
          score: eb('score', '+', catchItem.point_value),
          level_id: newLevel?.id ?? undefined,
        }))
        .where('id', '=', id)
        .execute()

      return ctx.json(catchItem)
    }
  )
  .put(
    '/update/:id',
    isAuth(),
    sValidator('param', type({ id: 'string' })),
    sValidator(
      'form',
      type({
        'length?': 'string.numeric.parse',
        'weight?': 'string.numeric.parse',
        'locationId?': 'string',
        'description?': 'string | null',
        'date?': 'string.date.parse',
        'pictures?': 'File',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const { date, description, length, locationId, weight, pictures } =
        ctx.req.valid('form')
      const { id } = ctx.req.valid('param')
      const {
        sub: { id: userId, score },
        role,
      } = ctx.get('userPayload')

      if (pictures && pictures.size > Number(env(ctx).MAX_FILE_SIZE)) {
        return ctx.json({ message: 'File too large' }, 400)
      }

      const picturesUrl = pictures ? [await uploadCatch(pictures)] : undefined

      const catchItemQuery = db.updateTable('catches').set({
        date: date?.toISOString(),
        description,
        length,
        weight,
        location_id: locationId,
        pictures: picturesUrl,
      })

      if (role === 'Admin') {
        catchItemQuery.where('id', '=', id)
      } else {
        catchItemQuery.where((eb) =>
          eb.and([eb('id', '=', id), eb('user_id', '=', userId)])
        )
      }

      const catchItem = await catchItemQuery.returningAll().executeTakeFirst()

      if (!catchItem) {
        return ctx.json({ message: 'Catch not found' }, 404)
      }

      const newLevel = await db
        .selectFrom('levels')
        .selectAll()
        .where((eb) =>
          eb.or([
            eb.and([
              eb('start', '>=', score ?? 0 + catchItem.point_value),
              eb('end', '<', score ?? 0 + catchItem.point_value),
            ]),
            eb('end', 'is', null),
          ])
        )
        .orderBy('value asc')
        .executeTakeFirst()

      await db
        .updateTable('users')
        .set((eb) => ({
          score: eb('score', '+', catchItem.point_value),
          level_id: newLevel?.id ?? undefined,
        }))
        .where('id', '=', id)
        .execute()

      return ctx.json(catchItem)
    }
  )
  .delete(
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

      const catchListQuery = db.deleteFrom('catches')

      if (role === 'Admin') {
        catchListQuery.where('id', '=', id)
      } else {
        catchListQuery.where((eb) =>
          eb.and([eb('id', '=', id), eb('user_id', '=', userId)])
        )
      }

      const catchList = await catchListQuery.returning('id').execute()

      if (catchList.length === 0) {
        return ctx.json({ message: 'Catch not found' }, 404)
      }

      return ctx.json({ message: 'Catch deleted' })
    }
  )

export default catchesRoute
