import { faker } from '@faker-js/faker'
import { randomFrom, randomNumber, randomsFrom } from './random'
import { hash } from '@node-rs/argon2'
import { db } from './db'

async function createUser(
  role: 'User' | 'Admin',
  level: string,
  username?: string,
  password?: string
) {
  const hashedPassword = await hash(password ?? faker.internet.password())

  const user = await db
    .insertInto('users')
    .values({
      email: faker.internet.email(),
      password: hashedPassword,
      username: username ?? faker.person.firstName(),
      role: role,
      profile_pic: 'https://thispersondoesnotexist.com/',
      level_id: level,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return user
}

async function createCategory() {
  const cat = await db
    .insertInto('categories')
    .values({
      name: faker.lorem.word(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return cat
}

async function createLevel(value: number, start: number, end?: number) {
  const level = await db
    .insertInto('levels')
    .values({
      title: faker.lorem.word(),
      value,
      start,
      end: end ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return level
}

async function createConversation(owner: string, cat: string) {
  const conversation = await db
    .insertInto('conversations')
    .values({
      user_id: owner,
      title: faker.lorem.word(),
      category_id: cat,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return conversation
}

async function createMessage(owner: string, conv: string) {
  const message = await db
    .insertInto('messages')
    .values({
      user_id: owner,
      conversation_id: conv,
      content: faker.lorem.sentence(),
      pictures: [],
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return message
}

async function createSpecies() {
  const spc = await db
    .insertInto('species')
    .values({
      name: faker.lorem.word(),
      point_value: faker.number.int({ max: 100 }),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return spc
}

async function createLocation(owner: string, species: string[]) {
  const loc = await db
    .insertInto('locations')
    .values({
      latitude: faker.location.latitude().toString(),
      longitude: faker.location.longitude().toString(),
      name: faker.lorem.word(),
      user_id: owner,
      description: faker.lorem.sentence(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  await Promise.all(
    species.map((s) =>
      db
        .insertInto('speciesLocation')
        .values({ location_id: loc.id, species_id: s })
        .execute()
    )
  )

  return loc
}

async function createCatch(owner: string, species: string, location: string) {
  const catchesItem = await db
    .insertInto('catches')
    .values({
      date: faker.date.recent().toISOString(),
      length: faker.number.int({ max: 100 }),
      weight: faker.number.int({ max: 100 }),
      location_id: location,
      pictures: [],
      point_value: faker.number.int({ max: 100 }),
      description: faker.lorem.sentence(),
      user_id: owner,
      species_id: species,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return catchesItem
}

export default async function seedDb() {
  const levelList = await Promise.all([
    createLevel(1, 0, 100),
    createLevel(2, 101, 200),
    createLevel(3, 201, 300),
    createLevel(4, 301),
  ])

  const userList = await Promise.all([
    ...Array.from({ length: 10 }, () => createUser('User', levelList[0].id)),
    createUser('Admin', levelList[0].id, 'admin', 'adminadmin'),
  ])

  const catList = await Promise.all(
    Array.from({ length: 3 }, () => createCategory())
  )

  const conversationList = await Promise.all(
    Array.from({ length: 20 }, () =>
      createConversation(randomFrom(userList).id, randomFrom(catList).id)
    )
  )

  for (const conv of conversationList) {
    await Promise.all(
      Array.from({ length: 10 }, () =>
        createMessage(randomFrom(userList).id, conv.id)
      )
    )
  }

  const speciesList = await Promise.all(
    Array.from({ length: 10 }, () => createSpecies())
  )

  const locationList = await Promise.all(
    Array.from({ length: 10 }, () =>
      createLocation(
        randomFrom(userList).id,
        randomsFrom(speciesList, randomNumber(5)).map((s) => s.id)
      )
    )
  )

  await Promise.all(
    Array.from({ length: 10 }, () =>
      createCatch(
        randomFrom(userList).id,
        randomFrom(speciesList).id,
        randomFrom(locationList).id
      )
    )
  )
}
