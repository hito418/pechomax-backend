import { userRolesEnum } from '@repo/schemas/users'
import { JWTPayload } from 'hono/utils/jwt/types'

export interface Payload extends JWTPayload {
  sub: {
    id: string
    username: string
    score: number | null
  }
  role: (typeof userRolesEnum.enumValues)[number]
}
