import { sValidator } from '@hono/standard-validator'
import { deleteCookie, setSignedCookie } from 'hono/cookie'
import { Payload } from '../types/payload'
import { sign } from 'hono/jwt'
import { isAuth } from 'src/middlewares/isAuth'
import { env } from 'hono/adapter'
import { type } from 'arktype'
import { HonoVar } from 'src/lib/hono'
import { hash, verify } from '@node-rs/argon2'

const authRoute = new HonoVar()
  .basePath('/auth')
  .post(
    '/init',
    sValidator(
      'json',
      type({
        username: 'string > 3',
        email: 'string.email',
        password: 'string > 8',
      })
    ),
    async (ctx) => {
      const { username, email, password } = ctx.req.valid('json')
      const db = ctx.get('database')

      const adminList = await db
        .selectFrom('users')
        .select('id')
        .where('role', '=', 'Admin')
        .execute()

      if (adminList.length > 0) {
        return ctx.json({ message: 'Admin already exists' }, 400)
      }

      const hashedPassword = await hash(password, {})

      const userList = await db
        .insertInto('users')
        .values({
          username,
          email,
          password: hashedPassword,
          role: 'Admin',
        })
        .returningAll()
        .execute()

      if (userList.length > 0) {
        const { password: _, ...user } = userList[0]

        return ctx.json(user, 201)
      }

      return ctx.json({ message: 'Failed to register' }, 500)
    }
  )
  .post(
    '/register',
    sValidator(
      'json',
      type({
        username: 'string > 3',
        email: 'string.email',
        password: 'string > 8',
      })
    ),
    async (ctx) => {
      const { username, email, password } = ctx.req.valid('json')
      const db = ctx.get('database')

      const hashedPassword = await hash(password)

      const userList = await db
        .insertInto('users')
        .values({
          username,
          email,
          password: hashedPassword,
          profile_pic:
            'https://firebasestorage.googleapis.com/v0/b/pechomax-cfa82.appspot.com/o/profilePic%2Fdefault.png?alt=media&token=58d39852-07a3-489c-9c51-3a448ea90729',
        })
        .returningAll()
        .execute()

      if (userList.length > 0) {
        const { password: _, ...user } = userList[0]

        const payload: Payload = {
          sub: {
            id: user.id,
            username: user.username,
            score: user.score,
          },
          role: user.role,
        }

        const { COOKIE_SECRET, JWT_SECRET } = env(ctx)

        const token = await sign(payload, JWT_SECRET)

        await setSignedCookie(ctx, 'access_token', token, COOKIE_SECRET)

        return ctx.json(payload, 201)
      }

      return ctx.json({ message: 'Failed to register' }, 500)
    }
  )
  .post(
    '/login',
    sValidator(
      'json',
      type({
        credential: 'string',
        password: 'string',
      })
    ),
    async (ctx) => {
      const { credential, password } = ctx.req.valid('json')
      const db = ctx.get('database')

      const user = await db
        .selectFrom('users')
        .selectAll()
        .where((eb) =>
          eb.or([eb('username', '=', credential), eb('email', '=', credential)])
        )
        .executeTakeFirst()

      if (!user) {
        return ctx.json({ message: 'User not found' }, 404)
      }

      const isMatch = await verify(password, user.password)

      if (isMatch) {
        const payload: Payload = {
          sub: {
            id: user.id,
            username: user.username,
            score: user.score,
          },
          role: user.role,
        }

        const { COOKIE_SECRET, JWT_SECRET } = env(ctx)

        const token = await sign(payload, JWT_SECRET)

        await setSignedCookie(ctx, 'access_token', token, COOKIE_SECRET)

        return ctx.json(payload, 200)
      }

      return ctx.json({ message: 'Wrong password' }, 401)
    }
  )
  .get('/login', isAuth(), async (ctx) => {
    const payload = ctx.get('userPayload')
    return ctx.json(payload.sub, 200)
  })
  .get('/logout', isAuth(), async (ctx) => {
    deleteCookie(ctx, 'access_token')
    return ctx.text('Logged out', 200)
  })

export default authRoute
