import { sValidator } from '@hono/standard-validator'
import { type } from 'arktype'
import { env } from 'hono/adapter'
import { uploadMessage } from 'src/lib/firebase'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'

const messagesRoute = new HonoVar().basePath('/messages')

messagesRoute.get(
  '/',
  sValidator('query', type({ 'page?': 'string.numeric.parse' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { page = 1 } = ctx.req.valid('query')

    const pageSize = Number(env(ctx).PAGE_SIZE)

    const messageList = await db
      .selectFrom('messages')
      .selectAll()
      .leftJoin('users', 'messages.user_id', 'users.id')
      .orderBy('messages.updated_at desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute()

    return ctx.json(messageList)
  }
)

messagesRoute.get('/self', isAuth(), async (ctx) => {
  const db = ctx.get('database')
  const {
    sub: { id },
  } = ctx.get('userPayload')

  const messageList = await db
    .selectFrom('messages')
    .selectAll()
    .where('messages.user_id', '=', id)
    .execute()

  return ctx.json(messageList)
})

messagesRoute.get(
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

    const messageItem = await db
      .selectFrom('messages')
      .selectAll()
      .leftJoin('users', 'messages.user_id', 'users.id')
      .where('messages.id', '=', id)
      .executeTakeFirst()

    if (!messageItem) {
      return ctx.json({ message: 'Message not found' }, 404)
    }

    return ctx.json(messageItem)
  }
)

messagesRoute.post(
  '/create',
  isAuth(),
  sValidator(
    'form',
    type({
      conversationId: 'string',
      content: 'string',
      'pictures?': 'File',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { conversationId, content, pictures } = ctx.req.valid('form')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')

    if (pictures && pictures.size > Number(env(ctx).MAX_FILE_SIZE)) {
      return ctx.json({ message: 'File too large' }, 400)
    }

    const picturesUrl = pictures ? [await uploadMessage(pictures)] : []

    const messageItem = await db
      .insertInto('messages')
      .values({
        conversation_id: conversationId,
        content,
        user_id: userId,
        pictures: picturesUrl,
      })
      .returningAll()
      .executeTakeFirst()

    if (!messageItem) {
      return ctx.json({ message: 'Failed to create message' }, 500)
    }

    return ctx.json(messageItem, 201)
  }
)

messagesRoute.put(
  '/update/:id',
  isAuth(),
  sValidator('param', type({ id: 'string' })),
  sValidator(
    'form',
    type({
      'content?': 'string',
      'pictures?': 'File',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const { pictures, ...updateMessage } = ctx.req.valid('form')
    const {
      sub: { id: userId },
      role,
    } = ctx.get('userPayload')

    if (pictures && pictures.size > Number(env(ctx).MAX_FILE_SIZE)) {
      return ctx.json({ message: 'File too large' }, 400)
    }

    const messageQuery = db
      .updateTable('messages')
      .set({ ...updateMessage })
      .where('messages.id', '=', id)

    if (pictures) {
      const picturesUrl = [await uploadMessage(pictures)]
      messageQuery.set({ ...updateMessage, pictures: picturesUrl })
    }

    if (role !== 'Admin') {
      messageQuery.where('messages.user_id', '=', userId)
    }

    const messageItem = await messageQuery.returningAll().executeTakeFirst()

    if (!messageItem) {
      return ctx.json({ message: 'Message not found' }, 404)
    }

    return ctx.json(messageItem)
  }
)

messagesRoute.delete(
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
      .deleteFrom('messages')
      .where('messages.id', '=', id)

    if (role !== 'Admin') {
      deleteQuery.where('messages.user_id', '=', userId)
    }

    const messageItem = await deleteQuery
      .returning('messages.id')
      .executeTakeFirst()

    if (!messageItem) {
      return ctx.json({ message: 'Message not found' }, 404)
    }

    return ctx.json(messageItem)
  }
)

export default messagesRoute
