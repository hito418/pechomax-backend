<p align="center">
  <a href="https://github.com/mathiascoutant/pechomax-frontend-mobile/" target="blank"><img src="https://cdn.discordapp.com/attachments/1226820829120036954/1227240273449582713/Pechomax__1_-removebg-preview.png?ex=66285852&is=662706d2&hm=36040edbfa06297a856ed180841b16bc4b78390ca86f4771b215cd3c4fc7f27f&" width="200" alt="Pechomax Logo" /></a>
</p>

<p align="center">A blazingly fast <a href="https://github.com/mathiascoutant/pechomax-frontend-mobile/" target="_blank">Forum</a> about fishing.</p>

## Description

This is the backend of the Pechomax project. It is a forum about fishing. It is made with [HonoJS](https://hono.dev/), a progressive Node.js framework for building efficient, reliable and scalable server-side applications.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development — local server + Postgres in Docker
$ docker compose -f deps.docker-compose.yaml up -d   # start Postgres only
$ npm run migrate                                     # apply migrations (first time, or after schema changes)
$ npm run dev                                         # start local dev server on localhost:3000
```

```bash
# development — everything in Docker (server + Drizzle Studio + Postgres)
$ docker compose -f dev.docker-compose.yaml up -d
# server on localhost:4000, Drizzle Studio on localhost:4983
# migrations run automatically on container start
```

```bash
# production mode
$ docker compose up -d
# launching on localhost/api
```

> **Note:** do not run `dev.docker-compose.yaml` and `npm run dev` at the same time — both would try to bind Drizzle Studio on port `4983`.

### Schema changes

```bash
$ npm run --filter @repo/schemas migration:generate  # generate a new migration file
$ npm run migrate                                     # apply it
```

### Demo seed

The deterministic demo seed is destructive: it clears PechoMax demo tables and reinserts demo users, species, locations, catches, conversations, messages, categories, and levels. It only runs automatically in local `NODE_ENV=DEV`.

To seed a deployed demo database intentionally:

```bash
$ npm run migrate
$ npm run seed:demo
```

Then verify:

```bash
$ curl https://pechomax.striffe.dev/species
$ curl https://pechomax.striffe.dev/locations/all
$ curl https://pechomax.striffe.dev/catches
$ curl https://pechomax.striffe.dev/conversations
```

when running in production mode, `parent.docker-compose.yaml` and `parent.nginx.conf` are supposed to be placed in the parent directory of [pechomax-backend](https://github.com/mathiascoutant/pechomax-backend) and [pechomax-frontend-web](https://github.com/mathiascoutant/pechomax-frontend-web).

## Demo accounts

All accounts share the same password: **`PechoMax123!`**

| Username | Email | Role | Catches |
|---|---|---|---|
| Admin PechoMax | admin@pechomax.dev | Admin | 0 |
| Marc Dubois | marc@pechomax.dev | User | 5 |
| Sophie Martin | sophie@pechomax.dev | User | 5 |
| Thomas Laurent | thomas@pechomax.dev | User | 5 |
| Nicolas Bernard | nicolas@pechomax.dev | User | 5 |
| Julie Chen | julie@pechomax.dev | User | 4 |
| Camille Moreau | camille@pechomax.dev | User | 4 |
| Hugo Petit | hugo@pechomax.dev | User | 4 |
