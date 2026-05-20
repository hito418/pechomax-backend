import { sValidator } from '@hono/standard-validator'
import { type } from 'arktype'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'

const commentsRoute = new HonoVar()
  .basePath('/comments')
  .delete('/:id', isAuth(), sValidator('param', type({ id: 'string' })), async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      role,
      sub: { id: userId },
    } = ctx.get('userPayload')

    const deleteQuery = db.deleteFrom('catch_comments').where('id', '=', id)

    if (role !== 'Admin') {
      deleteQuery.where('user_id', '=', userId)
    }

    const deleted = await deleteQuery.returning('id').executeTakeFirst()

    if (!deleted) {
      return ctx.json({ message: 'Comment not found' }, 404)
    }

    return ctx.json(deleted)
  })

export default commentsRoute
