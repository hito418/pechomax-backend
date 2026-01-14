import { Hono, MiddlewareHandler } from 'hono'
import { db } from './db'

export const HonoVar = Hono<{
  Variables: { database: typeof db }
  Bindings: typeof process.env
}>

export type HonoVarMiddleware<T extends { [K: string]: unknown }> =
  MiddlewareHandler<{
    Variables: { database: typeof db } & T
    Bindings: typeof process.env
  }>
