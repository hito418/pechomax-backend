import { sValidator } from '@hono/standard-validator'
import { type } from 'arktype'
import { env } from 'hono/adapter'
import { setSignedCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'
import { uploadProfile } from 'src/lib/firebase'
import { HonoVar } from 'src/lib/hono'
import { isAuth } from 'src/middlewares/isAuth'
import { Payload } from 'src/types/payload'

const usersRoute = new HonoVar().basePath('/users')

usersRoute.get(
  '/',
  sValidator('query', type({ 'page?': 'string.numeric.parse' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { page = 1 } = ctx.req.valid('query')

    const pageSize = Number(env(ctx).PAGE_SIZE)

    const userList = await db
      .selectFrom('users')
      .select([
        'users.id',
        'users.username',
        'users.email',
        'users.role',
        'users.phone_number',
        'users.profile_pic',
        'users.city',
        'users.region',
        'users.zip_code',
        'users.level_id',
        'users.score',
        'users.created_at',
        'users.updated_at',
      ])
      .orderBy('users.updated_at desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute()

    return ctx.json(userList, 200)
  }
)

usersRoute.get('/all', async (ctx) => {
  const db = ctx.get('database')

  const userList = await db
    .selectFrom('users')
    .select([
      'users.id',
      'users.username',
      'users.email',
      'users.role',
      'users.phone_number',
      'users.profile_pic',
      'users.city',
      'users.region',
      'users.zip_code',
      'users.level_id',
      'users.score',
      'users.created_at',
      'users.updated_at',
    ])
    .execute()

  return ctx.json(userList, 200)
})

usersRoute.get('/self', isAuth(), async (ctx) => {
  const db = ctx.get('database')
  const {
    sub: { id },
  } = ctx.get('userPayload')

  const user = await db
    .selectFrom('users')
    .select([
      'users.id',
      'users.username',
      'users.email',
      'users.role',
      'users.phone_number',
      'users.profile_pic',
      'users.city',
      'users.region',
      'users.zip_code',
      'users.level_id',
      'users.score',
      'users.created_at',
      'users.updated_at',
    ])
    .where('users.id', '=', id)
    .executeTakeFirst()

  if (!user) {
    return ctx.json({ message: 'User not found' }, 404)
  }

  return ctx.json(user, 200)
})

usersRoute.get(
  '/:username',
  sValidator(
    'param',
    type({
      username: 'string',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { username } = ctx.req.valid('param')

    const user = await db
      .selectFrom('users')
      .select([
        'users.id',
        'users.username',
        'users.email',
        'users.role',
        'users.phone_number',
        'users.profile_pic',
        'users.city',
        'users.region',
        'users.zip_code',
        'users.level_id',
        'users.score',
        'users.created_at',
        'users.updated_at',
      ])
      .where('users.username', '=', username)
      .executeTakeFirst()

    if (!user) {
      return ctx.json({ message: 'User not found' }, 404)
    }

    return ctx.json(user, 200)
  }
)

usersRoute.post(
  '/create',
  isAuth('Admin'),
  sValidator(
    'json',
    type({
      username: 'string > 3',
      email: 'string.email',
      password: 'string > 8',
      role: "'Admin' | 'User'",
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { username, email, password, role } = ctx.req.valid('json')

    const user = await db
      .insertInto('users')
      .values({
        username,
        email,
        password,
        role,
        profile_pic:
          'https://firebasestorage.googleapis.com/v0/b/pechomax-cfa82.appspot.com/o/profilePic%2Fdefault.png?alt=media&token=58d39852-07a3-489c-9c51-3a448ea90729',
      })
      .returningAll()
      .executeTakeFirst()

    if (!user) {
      return ctx.json({ message: 'Internal server error' }, 500)
    }

    return ctx.json(user, 201)
  }
)

usersRoute.put(
  '/update/self',
  isAuth(),
  sValidator(
    'form',
    type({
      'username?': 'string > 3',
      'email?': 'string.email',
      'password?': 'string > 8',
      'phoneNumber?': 'string | null',
      'profilePic?': 'File | null',
      'city?': 'string | null',
      'region?': 'string | null',
      'zipCode?': 'string | null',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const {
      sub: { id },
    } = ctx.get('userPayload')
    const {
      profilePic,
      phoneNumber,
      zipCode,
      ...updateDatas
    } = ctx.req.valid('form')

    if (profilePic && profilePic.size > Number(env(ctx).MAX_FILE_SIZE)) {
      return ctx.json({ message: 'File too large' }, 400)
    }

    const updatePayload: Record<string, unknown> = { ...updateDatas }

    if (profilePic) {
      updatePayload.profile_pic = await uploadProfile(profilePic)
    }

    if (phoneNumber !== undefined) {
      updatePayload.phone_number = phoneNumber
    }

    if (zipCode !== undefined) {
      updatePayload.zip_code = zipCode
    }

    const user = await db
      .updateTable('users')
      .set(updatePayload)
      .where('users.id', '=', id)
      .returning([
        'users.id',
        'users.username',
        'users.email',
        'users.role',
        'users.phone_number',
        'users.profile_pic',
        'users.city',
        'users.region',
        'users.zip_code',
        'users.level_id',
        'users.score',
        'users.created_at',
        'users.updated_at',
      ])
      .executeTakeFirst()

    if (!user) {
      return ctx.json({ message: 'User not found' }, 404)
    }

    const newPayload: Payload = {
      sub: {
        id: user.id,
        username: user.username,
        score: user.score,
      },
      role: user.role,
    }

    const { COOKIE_SECRET, JWT_SECRET } = env(ctx)

    const token = await sign(newPayload, JWT_SECRET)

    await setSignedCookie(ctx, 'access_token', token, COOKIE_SECRET)

    return ctx.json(user, 200)
  }
)

usersRoute.put(
  '/update/:id',
  isAuth('Admin'),
  sValidator('param', type({ id: 'string' })),
  sValidator(
    'form',
    type({
      'username?': 'string > 3',
      'email?': 'string.email',
      'password?': 'string > 8',
      'role?': "'Admin' | 'User'",
      'phoneNumber?': 'string | null',
      'profilePic?': 'File | null',
      'city?': 'string | null',
      'region?': 'string | null',
      'zipCode?': 'string | null',
      'score?': 'string.numeric.parse | null',
    })
  ),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')
    const {
      profilePic,
      phoneNumber,
      zipCode,
      ...updateDatas
    } = ctx.req.valid('form')
    const {
      sub: { id: userId },
    } = ctx.get('userPayload')

    if (profilePic && profilePic.size > Number(env(ctx).MAX_FILE_SIZE)) {
      return ctx.json({ message: 'File too large' }, 400)
    }

    const updatePayload: Record<string, unknown> = { ...updateDatas }

    if (profilePic) {
      updatePayload.profile_pic = await uploadProfile(profilePic)
    }

    if (phoneNumber !== undefined) {
      updatePayload.phone_number = phoneNumber
    }

    if (zipCode !== undefined) {
      updatePayload.zip_code = zipCode
    }

    const user = await db
      .updateTable('users')
      .set(updatePayload)
      .where('users.id', '=', id)
      .returning([
        'users.id',
        'users.username',
        'users.email',
        'users.role',
        'users.phone_number',
        'users.profile_pic',
        'users.city',
        'users.region',
        'users.zip_code',
        'users.level_id',
        'users.score',
        'users.created_at',
        'users.updated_at',
      ])
      .executeTakeFirst()

    if (!user) {
      return ctx.json({ message: 'User not found' }, 404)
    }

    if (id === userId) {
      const newPayload: Payload = {
        sub: {
          id: user.id,
          username: user.username,
          score: user.score,
        },
        role: user.role,
      }

      const { COOKIE_SECRET, JWT_SECRET } = env(ctx)

      const token = await sign(newPayload, JWT_SECRET)

      await setSignedCookie(ctx, 'access_token', token, COOKIE_SECRET)
    }
    return ctx.json(user, 200)
  }
)

usersRoute.delete(
  '/delete/:id',
  isAuth(),
  sValidator('param', type({ id: 'string' })),
  async (ctx) => {
    const db = ctx.get('database')
    const { id } = ctx.req.valid('param')

    const user = await db
      .deleteFrom('users')
      .where('users.id', '=', id)
      .returning('users.id')
      .executeTakeFirst()

    if (!user) {
      return ctx.json({ message: 'User not found' }, 404)
    }

    return ctx.json(user, 200)
  }
)

usersRoute.delete('/delete/self', isAuth(), async (ctx) => {
  const db = ctx.get('database')
  const {
    sub: { id },
  } = ctx.get('userPayload')

  const user = await db
    .deleteFrom('users')
    .where('users.id', '=', id)
    .returning('users.id')
    .executeTakeFirst()

  if (!user) {
    return ctx.json({ message: 'User not found' }, 404)
  }

  return ctx.json(user, 200)
})

export default usersRoute
