import { sValidator } from '@hono/standard-validator'
import { uploadMessage } from 'src/lib/firebase'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'
import { env } from 'hono/adapter'
import { type } from 'arktype'

const conversationsRoute = new HonoVar()
  .basePath('/conversations')
  .get('/', sValidator('query', type({ page: 'number?' })), async (ctx) => {
    const db = ctx.get('database')
    const { page = 1 } = ctx.req.valid('query')

    const pageSize = Number(env(ctx).PAGE_SIZE)

    const conversations = await db
      .selectFrom('conversations')
      .leftJoin('messages', 'conversations.id', 'messages.conversation_id')
      .leftJoin('users', 'conversations.user_id', 'users.id')
      .leftJoin('categories', 'conversations.category_id', 'categories.id')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .orderBy('conversations.updated_at', 'desc')
      .selectAll()
      .execute()

    return ctx.json(conversations)
  })
  .get('/self', isAuth(), async (ctx) => {
    const db = ctx.get('database')
    const {
      sub: { id },
    } = ctx.get('userPayload')

    const conversations = await db
      .selectFrom('conversations')
      .leftJoin(
        (eb) =>
          eb
            .selectFrom('messages as m')
            .where('m.user_id', '=', id)
            .orderBy('m.created_at', 'desc')
            .limit(3)
            .selectAll()
            .as('latest_messages'),
        (join) =>
          join.onRef('latest_messages.conversation_id', '=', 'conversations.id')
      )
      .leftJoin('users', 'conversations.user_id', 'users.id')
      .leftJoin('categories', 'conversations.category_id', 'categories.id')
      .where('user_id', '=', id)
      .orderBy('conversations.updated_at', 'desc')
      .selectAll()
      .execute()

    return ctx.json(conversations)
  })
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

      const conversation = await db
        .selectFrom('conversations')
        .leftJoin(
          (eb) =>
            eb
              .selectFrom('messages as m')
              .orderBy('m.created_at', 'desc')
              .selectAll()
              .as('latest_messages'),
          (join) =>
            join.onRef(
              'latest_messages.conversation_id',
              '=',
              'conversations.id'
            )
        )
        .leftJoin('users', 'conversations.user_id', 'users.id')
        .leftJoin('categories', 'conversations.category_id', 'categories.id')
        .where('conversations.id', '=', id)
        .orderBy('conversations.updated_at', 'desc')
        .selectAll()
        .executeTakeFirst()

      if (!conversation) {
        return ctx.json({ message: 'Conversation not found' }, 404)
      }

      return ctx.json(conversation)
    }
  )
  .get(
    '/:id/messages',
    sValidator(
      'param',
      type({
        id: 'string',
      })
    ),
    sValidator(
      'query',
      type({
        page: 'string.numeric.parse?',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const { id } = ctx.req.valid('param')
      const { page = 1 } = ctx.req.valid('query')

      const pageSize = Number(env(ctx).PAGE_SIZE)

      const messageList = await db
        .selectFrom('messages')
        .leftJoin('users', 'messages.user_id', 'users.id')
        .where('messages.conversation_id', '=', id)
        .orderBy('messages.created_at', 'desc')
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .selectAll()
        .execute()

      if (messageList.length === 0) {
        return ctx.json({ message: 'Conversation not found' }, 404)
      }

      return ctx.json(messageList)
    }
  )
  .post(
    '/create',
    isAuth(),
    sValidator(
      'json',
      type({
        title: 'string > 3',
        categoryId: 'string',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const payload = ctx.get('userPayload')
      const { title, categoryId } = ctx.req.valid('json')

      const conversationList = await db
        .insertInto('conversations')
        .values({
          title: title,
          category_id: categoryId,
          user_id: payload.sub.id,
        })
        .returningAll()
        .execute()

      if (conversationList.length === 0) {
        return ctx.json({ message: 'Internal server error' }, 500)
      }

      const conversation = conversationList[0]

      return ctx.json(conversation, 201)
    }
  )
  .post(
    '/start',
    isAuth(),
    sValidator(
      'form',
      type({
        title: 'string > 3',
        categoryId: 'string',
        content: 'string',
        pictures: '(File | null)?',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const payload = ctx.get('userPayload')
      const { title, categoryId, content, pictures } = ctx.req.valid('form')

      const conversationList = await db
        .insertInto('conversations')
        .values({
          title: title,
          category_id: categoryId,
          user_id: payload.sub.id,
        })
        .returningAll()
        .execute()

      if (conversationList.length === 0) {
        return ctx.json({ message: 'Internal server error' }, 500)
      }

      const conversation = conversationList[0]

      const picturesUrl = pictures ? [await uploadMessage(pictures)] : []

      const messageList = await db
        .insertInto('messages')
        .values({
          content,
          conversation_id: conversation.id,
          user_id: payload.sub.id,
          pictures: picturesUrl,
        })
        .returningAll()
        .execute()

      if (messageList.length === 0) {
        return ctx.json({ message: 'Internal server error' }, 500)
      }

      const message = messageList[0]

      return ctx.json({ conversation, message }, 201)
    }
  )
  .put(
    '/update/:id',
    isAuth(),
    sValidator(
      'param',
      type({
        id: 'string',
      })
    ),
    sValidator(
      'json',
      type({
        title: '(string > 3)?',
        categoryId: 'string?',
      })
    ),
    async (ctx) => {
      const db = ctx.get('database')
      const {
        role,
        sub: { id: userId },
      } = ctx.get('userPayload')
      const { id } = ctx.req.valid('param')
      const { title, categoryId } = ctx.req.valid('json')

      const conversationListQuery = db.updateTable('conversations').set({
        title,
        category_id: categoryId,
      })

      if (role === 'Admin') {
        conversationListQuery.where('conversations.id', '=', id)
      } else {
        conversationListQuery
          .where('conversations.id', '=', id)
          .where('conversations.user_id', '=', userId)
      }

      const conversationList = await conversationListQuery
        .returningAll()
        .execute()

      if (conversationList.length === 0) {
        return ctx.json({ message: 'Conversation not found' }, 404)
      }

      const conversation = conversationList[0]

      return ctx.json(conversation)
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
        role,
        sub: { id: userId },
      } = ctx.get('userPayload')

      const conversationListQuery = db.deleteFrom('conversations')

      if (role === 'Admin') {
        conversationListQuery.where('conversations.id', '=', id)
      } else {
        conversationListQuery
          .where('conversations.id', '=', id)
          .where('conversations.user_id', '=', userId)
      }
      const conversationList = await conversationListQuery
        .returning(['id'])
        .execute()

      if (conversationList.length === 0) {
        return ctx.json({ message: 'Conversation not found' }, 404)
      }

      const conversation = conversationList[0]

      return ctx.json(conversation, 200)
    }
  )

export default conversationsRoute
