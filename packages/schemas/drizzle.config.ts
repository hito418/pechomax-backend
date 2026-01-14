import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schemas/**/*',
  out: './migrations',
  dbCredentials: {
    url: 'postgresql://user:password@database:5432/pechomax',
  },
})
