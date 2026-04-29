import { type } from 'arktype'

const envSchema = type({
  PG_HOST: 'string',
  PG_PORT: 'string.numeric',
  PG_DB: 'string',
  PG_USER: 'string',
  PG_PASSWORD: 'string',
  COOKIE_SECRET: 'string',
  JWT_SECRET: 'string',
  CORS_ORIGIN: 'string',
  FIREBASE_PROJECT_ID: 'string',
  FIREBASE_CLIENT_EMAIL: 'string',
  FIREBASE_PRIVATE_KEY: 'string',
  FIREBASE_STORAGE_BUCKET: 'string',
  PAGE_SIZE: type('string.numeric').default('15'),
  MAX_FILE_SIZE: type('string.numeric').default((10 * 1024 * 1024).toString()),
  APP_PORT: type('string.numeric').default('3000'),
  NODE_ENV: '"DEV" | "PROD"',
})

const result = envSchema(process.env)
if (result instanceof type.errors) {
  console.error(result)
  console.error('Invalid Environment Variables')
  process.exit(1)
}

type out = typeof envSchema.inferOut

declare global {
  namespace NodeJS {
    interface ProcessEnv extends out {}
  }
}

export {}
