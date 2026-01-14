import { showRoutes } from 'hono/dev'
import { serve } from '@hono/node-server'
import './lib/env'
import { db } from './lib/db'
import authRoute from './routes/auth'
import { cors } from 'hono/cors'
import usersRoute from './routes/users'
import categoriesRoute from './routes/categories'
import conversationsRoute from './routes/conversations'
import messagesRoute from './routes/messages'
import { HonoVar } from './lib/hono'
import { env } from 'hono/adapter'
import catchesRoute from './routes/catches'
import speciesRoute from './routes/species'
import locationsRoute from './routes/location'
import speciesLocationRoute from './routes/speciesLocation'
import levelsRoute from './routes/levels'
import seedDb from './lib/seed'

if (process?.env?.NODE_ENV === 'DEV') {
  try {
    await seedDb()
  } catch {}
}

const app = new HonoVar()
  .use(async (ctx, next) => {
    ctx.set('database', db)
    await next()
  })
  .use(
    cors({
      origin: (_, ctx) => env(ctx)['CORS_ORIGIN'],
      credentials: true,
    })
  )
  .route('/', authRoute)
  .route('/', usersRoute)
  .route('/', categoriesRoute)
  .route('/', conversationsRoute)
  .route('/', messagesRoute)
  .route('/', catchesRoute)
  .route('/', speciesRoute)
  .route('/', locationsRoute)
  .route('/', speciesLocationRoute)
  .route('/', levelsRoute)

if (process?.env?.NODE_ENV === 'DEV') {
  showRoutes(app)
}

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => console.log(`Listening on http://localhost:${info.port}`)
)
