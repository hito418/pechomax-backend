import { sValidator } from '@hono/standard-validator'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'
import { env } from 'hono/adapter'
import { type } from 'arktype'

const categoriesRoute = new HonoVar()
  .basePath('/categories')
  .post(
    '/create',
    isAuth('Admin'),
    sValidator(
      'json',
      type({
        name: 'string > 3',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const { name } = ctx.req.valid('json')

      const categoryItem = await db
        .insertInto('categories')
        .values({ name })
        .returningAll()
        .executeTakeFirst()

      if (!categoryItem) {
        return ctx.json({ message: 'Internal server error' }, 500)
      }

      return ctx.json(categoryItem, 201)
    }
  )
  .get(
    '/',
    sValidator('query', type({ 'page?': 'string.numeric.parse' })),
    async (ctx) => {
      const db = ctx.get('database')
      const { page = 1 } = ctx.req.valid('query')

      const pageSize = Number(env(ctx).PAGE_SIZE)

      const categoryList = await db
        .selectFrom('categories')
        .selectAll()
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute()

      return ctx.json(categoryList)
    }
  )
  .get(
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

      const categoryItem = await db
        .selectFrom('categories')
        .selectAll()
        .where('id', '=', id)
        .execute()

      if (!categoryItem) {
        return ctx.json({ message: 'Category not found' }, 404)
      }

      return ctx.json(categoryItem, 200)
    }
  )
  .put(
    '/update/:id',
    isAuth('Admin'),
    sValidator(
      'param',
      type({
        id: 'string',
      })
    ),
    sValidator(
      'json',
      type({
        name: 'string > 3',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const { id } = ctx.req.valid('param')
      const updateDatas = ctx.req.valid('json')

      const categoryItem = await db
        .updateTable('categories')
        .set(updateDatas)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()

      if (!categoryItem) {
        return ctx.json({ message: 'Category not found' }, 404)
      }

      return ctx.json(categoryItem, 201)
    }
  )
  .delete(
    '/delete/:id',
    isAuth('Admin'),
    sValidator('param', type({ id: 'string' })),
    async (ctx) => {
      const db = ctx.get('database')
      const { id } = ctx.req.valid('param')

      const categoryItem = await db
        .deleteFrom('categories')
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst()

      if (!categoryItem) {
        return ctx.json({ message: 'Category not found' }, 404)
      }

      const category = categoryItem

      return ctx.json(category, 200)
    }
  )

export default categoriesRoute
