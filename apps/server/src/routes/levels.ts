import { sValidator } from '@hono/standard-validator'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'
import { env } from 'hono/adapter'
import { type } from 'arktype'

const levelsRoute = new HonoVar()
  .basePath('/levels')
  .use(isAuth('Admin'))
  .get(
    '/',
    sValidator('query', type({ page: 'string.numeric.parse?' })),
    async (ctx) => {
      const db = ctx.get('database')
      const { page = 1 } = ctx.req.valid('query')

      const pageSize = Number(env(ctx).PAGE_SIZE)

      const levelList = await db
        .selectFrom('levels')
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .selectAll()
        .execute()

      return ctx.json(levelList, 200)
    }
  )
  .get('/:id', sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')

    const level = await db
      .selectFrom('levels')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!level) {
      return ctx.json({ message: 'Level not found' }, 404)
    }

    return ctx.json(level, 200)
  })
  .post(
    '/create',
    sValidator(
      'json',
      type({
        title: 'string',
        value: 'number',
        start: 'number',
        end: 'number?',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const { title, value, start, end } = ctx.req.valid('json')

      const levelList = await db
        .insertInto('levels')
        .values({
          title,
          value,
          start,
          end,
        })
        .returningAll()
        .execute()

      if (levelList.length === 0) {
        return ctx.json({ message: 'Failed to create level' }, 500)
      }

      return ctx.json(levelList[0], 201)
    }
  )
  .put(
    '/update/:id',
    sValidator('param', type({ id: 'string' })),
    sValidator(
      'json',
      type({
        title: 'string?',
        value: 'number?',
        start: 'number?',
        end: 'number?',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const { id } = ctx.req.valid('param')
      const updateDatas = ctx.req.valid('json')

      const levelList = await db
        .updateTable('levels')
        .set(updateDatas)
        .where('levels.id', '=', id)
        .returningAll()
        .execute()

      if (levelList.length === 0) {
        return ctx.json({ message: 'Failed to update level' }, 500)
      }

      return ctx.json(levelList[0], 200)
    }
  )
  .delete(
    '/delete/:id',
    sValidator('param', type({ id: 'string' })),
    async (ctx) => {
      const db = ctx.get('database')
      const { id } = ctx.req.valid('param')

      const levelList = await db
        .deleteFrom('levels')
        .where('levels.id', '=', id)
        .returning('id')
        .execute()

      if (levelList.length === 0) {
        return ctx.json({ message: 'Failed to delete level' }, 500)
      }

      return ctx.json(levelList[0], 200)
    }
  )

export default levelsRoute
