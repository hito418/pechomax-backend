import { userRolesEnum } from '@repo/schemas/users'
import { env } from 'hono/adapter'
import { getSignedCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { type HonoVarMiddleware } from 'src/lib/hono'
import { Payload } from 'src/types/payload'

export const isAuth: (
  ...roleList: (typeof userRolesEnum.enumValues)[number][]
) => HonoVarMiddleware<{ userPayload: Payload }> = function (...roleList) {
  return async (ctx, next) => {
    const { COOKIE_SECRET, JWT_SECRET } = env(ctx)
    const token = await getSignedCookie(ctx, COOKIE_SECRET, 'access_token')

    if (!token) {
      return ctx.json({ message: 'Unauthorized' }, 401)
    }

    const payload = await verify(token, JWT_SECRET)

    if (!payload) {
      return ctx.json({ message: 'Unauthorized' }, 401)
    }

    if (
      roleList.length > 0 &&
      !roleList.includes(
        payload.role as (typeof userRolesEnum.enumValues)[number]
      )
    ) {
      return ctx.json({ message: 'Unauthorized' }, 401)
    }

    ctx.set('userPayload', payload as Payload)

    await next()
  }
}
