import { sValidator } from '@hono/standard-validator'
import { type } from 'arktype'
import { env } from 'hono/adapter'
import { sql } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'
import { uploadCatch } from 'src/lib/firebase'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'

const socialSelects = [
  sql<number>`(select count(*)::int from catch_likes where catch_likes.catch_id = catches.id)`.as(
    'likesCount'
  ),
  sql<number>`(select count(*)::int from catch_comments where catch_comments.catch_id = catches.id)`.as(
    'commentsCount'
  ),
  sql<number>`(select count(*)::int from saved_catches where saved_catches.catch_id = catches.id)`.as(
    'savesCount'
  ),
] as const

function scoreWeightUnit(weight: number) {
  return Math.max(1, Math.round(weight / 1000))
}

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
        .selectAll('catches')
        .select((eb) => [
          ...socialSelects,
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
              .whereRef('users.id', '=', 'catches.user_id')
          ).as('user'),
          jsonObjectFrom(
            eb
              .selectFrom('species')
              .selectAll()
              .whereRef('species.id', '=', 'catches.species_id')
          ).as('species'),
          jsonObjectFrom(
            eb
              .selectFrom('locations')
              .selectAll()
              .whereRef('locations.id', '=', 'catches.location_id')
          ).as('location'),
        ])
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
      .selectAll('catches')
      .select((eb) => [
        ...socialSelects,
        jsonObjectFrom(
          eb
            .selectFrom('species')
            .selectAll()
            .whereRef('species.id', '=', 'catches.species_id')
        ).as('species'),
        jsonObjectFrom(
          eb
            .selectFrom('locations')
            .selectAll()
            .whereRef('locations.id', '=', 'catches.location_id')
        ).as('location'),
      ])
      .where('catches.user_id', '=', id)
      .orderBy('catches.updated_at desc')
      .execute()

    return ctx.json(catchList)
  })
  .get('/saved/self', isAuth(), async (ctx) => {
    const db = ctx.get('database')
    const {
      sub: { id },
    } = ctx.get('userPayload')

    const catchList = await db
      .selectFrom('saved_catches')
      .innerJoin('catches', 'catches.id', 'saved_catches.catch_id')
      .selectAll('catches')
      .select((eb) => [
        ...socialSelects,
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
            .whereRef('users.id', '=', 'catches.user_id')
        ).as('user'),
        jsonObjectFrom(
          eb
            .selectFrom('species')
            .selectAll()
            .whereRef('species.id', '=', 'catches.species_id')
        ).as('species'),
        jsonObjectFrom(
          eb
            .selectFrom('locations')
            .selectAll()
            .whereRef('locations.id', '=', 'catches.location_id')
        ).as('location'),
      ])
      .where('saved_catches.user_id', '=', id)
      .orderBy('saved_catches.updated_at desc')
      .execute()

    return ctx.json(catchList)
  })
  .get('/:id/social', isAuth(), sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')

    const [likes, comments, saves, liked, saved] = await Promise.all([
      db.selectFrom('catch_likes').select((eb) => eb.fn.countAll<number>().as('count')).where('catch_id', '=', id).executeTakeFirst(),
      db.selectFrom('catch_comments').select((eb) => eb.fn.countAll<number>().as('count')).where('catch_id', '=', id).executeTakeFirst(),
      db.selectFrom('saved_catches').select((eb) => eb.fn.countAll<number>().as('count')).where('catch_id', '=', id).executeTakeFirst(),
      db.selectFrom('catch_likes').select('id').where('catch_id', '=', id).where('user_id', '=', userId).executeTakeFirst(),
      db.selectFrom('saved_catches').select('id').where('catch_id', '=', id).where('user_id', '=', userId).executeTakeFirst(),
    ])

    return ctx.json({
      commentsCount: Number(comments?.count ?? 0),
      isLikedByMe: Boolean(liked),
      isSavedByMe: Boolean(saved),
      likesCount: Number(likes?.count ?? 0),
      savesCount: Number(saves?.count ?? 0),
    })
  })
  .get('/:id/comments', sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')

    const comments = await db
      .selectFrom('catch_comments')
      .selectAll('catch_comments')
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
            .whereRef('users.id', '=', 'catch_comments.user_id')
        ).as('user'),
      ])
      .where('catch_comments.catch_id', '=', id)
      .orderBy('catch_comments.created_at asc')
      .execute()

    return ctx.json(comments)
  })
  .post(
    '/:id/comments',
    isAuth(),
    sValidator('param', type({ id: 'string' })),
    sValidator('json', type({ content: 'string > 0' })),
    async (ctx) => {
      const db = ctx.get('database')
      const { id } = ctx.req.valid('param')
      const { content } = ctx.req.valid('json')
      const {
        sub: { id: userId },
      } = ctx.get('userPayload')

      const comment = await db
        .insertInto('catch_comments')
        .values({ catch_id: id, content: content.trim(), user_id: userId })
        .returningAll()
        .executeTakeFirst()

      if (!comment) {
        return ctx.json({ message: 'Failed to create comment' }, 500)
      }

      const returningComment = await db
        .selectFrom('catch_comments')
        .selectAll('catch_comments')
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
              .whereRef('users.id', '=', 'catch_comments.user_id')
          ).as('user'),
        ])
        .where('catch_comments.id', '=', comment.id)
        .executeTakeFirst()

      return ctx.json(returningComment ?? comment, 201)
    }
  )
  .post('/:id/like', isAuth(), sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')

    await db
      .insertInto('catch_likes')
      .values({ catch_id: id, user_id: userId })
      .onConflict((oc) => oc.columns(['user_id', 'catch_id']).doNothing())
      .execute()

    return ctx.json({ liked: true })
  })
  .delete('/:id/like', isAuth(), sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')

    await db.deleteFrom('catch_likes').where('catch_id', '=', id).where('user_id', '=', userId).execute()
    return ctx.json({ liked: false })
  })
  .post('/:id/save', isAuth(), sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')

    await db
      .insertInto('saved_catches')
      .values({ catch_id: id, user_id: userId })
      .onConflict((oc) => oc.columns(['user_id', 'catch_id']).doNothing())
      .execute()

    return ctx.json({ saved: true })
  })
  .delete('/:id/save', isAuth(), sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')

    await db.deleteFrom('saved_catches').where('catch_id', '=', id).where('user_id', '=', userId).execute()
    return ctx.json({ saved: false })
  })
  .get('/:id', sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')

    const catchItem = await db
      .selectFrom('catches')
      .selectAll('catches')
      .select((eb) => [
        ...socialSelects,
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
            .whereRef('users.id', '=', 'catches.user_id')
        ).as('user'),
        jsonObjectFrom(
          eb
            .selectFrom('species')
            .selectAll()
            .whereRef('species.id', '=', 'catches.species_id')
        ).as('species'),
        jsonObjectFrom(
          eb
            .selectFrom('locations')
            .selectAll()
            .whereRef('locations.id', '=', 'catches.location_id')
        ).as('location'),
      ])
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
          date: date.toISOString().slice(0, 10),
          length,
          weight,
          location_id: locationId,
          pictures: picturesUrl,
          point_value: species.point_value * length * scoreWeightUnit(weight),
          user_id: id,
          description,
          species_id: speciesId,
        })
        .returningAll()
        .executeTakeFirst()

      if (!catchItem) {
        return ctx.json({ message: 'Failed to create catch' }, 500)
      }

      const newScore = (score ?? 0) + catchItem.point_value
      const newLevel = await db
        .selectFrom('levels')
        .selectAll()
        .where((eb) =>
          eb.and([
            eb('start', '<=', newScore),
            eb.or([eb('end', '>=', newScore), eb('end', 'is', null)]),
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

      const returningCatch = await db
        .selectFrom('catches')
        .selectAll('catches')
        .select((eb) => [
          ...socialSelects,
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
              .whereRef('users.id', '=', 'catches.user_id')
          ).as('user'),
          jsonObjectFrom(
            eb
              .selectFrom('species')
              .selectAll()
              .whereRef('species.id', '=', 'catches.species_id')
          ).as('species'),
          jsonObjectFrom(
            eb
              .selectFrom('locations')
              .selectAll()
              .whereRef('locations.id', '=', 'catches.location_id')
          ).as('location'),
        ])
        .where('catches.id', '=', catchItem.id)
        .executeTakeFirst()

      return ctx.json(returningCatch ?? catchItem)
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
        sub: { id: userId },
        role,
      } = ctx.get('userPayload')

      if (pictures && pictures.size > Number(env(ctx).MAX_FILE_SIZE)) {
        return ctx.json({ message: 'File too large' }, 400)
      }

      const picturesUrl = pictures ? [await uploadCatch(pictures)] : undefined
      const updatePayload: Record<string, unknown> = {
        date: date?.toISOString().slice(0, 10),
        description,
        length,
        weight,
        location_id: locationId,
        pictures: picturesUrl,
      }

      if (weight !== undefined && length !== undefined) {
        const catchItem = await db.selectFrom('catches').select(['species_id']).where('id', '=', id).executeTakeFirst()
        const species = catchItem?.species_id
          ? await db.selectFrom('species').select(['point_value']).where('id', '=', catchItem.species_id).executeTakeFirst()
          : null
        if (species) {
          updatePayload.point_value = species.point_value * length * scoreWeightUnit(weight)
        }
      }

      let catchItemQuery = db.updateTable('catches').set(updatePayload)

      if (role === 'Admin') {
        catchItemQuery = catchItemQuery.where('id', '=', id)
      } else {
        catchItemQuery = catchItemQuery.where((eb) =>
          eb.and([eb('id', '=', id), eb('user_id', '=', userId)])
        )
      }

      const catchItem = await catchItemQuery.returningAll().executeTakeFirst()

      if (!catchItem) {
        return ctx.json({ message: 'Catch not found' }, 404)
      }

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

      let catchListQuery = db.deleteFrom('catches')

      if (role === 'Admin') {
        catchListQuery = catchListQuery.where('id', '=', id)
      } else {
        catchListQuery = catchListQuery.where((eb) =>
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
