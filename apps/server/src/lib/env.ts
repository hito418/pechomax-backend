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
  FIREBASE_API_KEY: 'string',
  FIREBASE_AUTH_DOMAIN: 'string',
  FIREBASE_PROJECT_ID: 'string',
  FIREBASE_STORAGE_BUCKET: 'string',
  FIREBASE_MESSAGING_SENDER_ID: 'string',
  FIREBASE_APP_ID: 'string',
  FIREBASE_MEASUREMENT_ID: 'string',
  PAGE_SIZE: type.string.default('15'),
  MAX_FILE_SIZE: type.string.default((10 * 1024 * 1024).toString()),
  NODE_ENV: '"DEV" | "PROD"',
})

const result = envSchema(process.env)
if (result instanceof type.errors) {
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
