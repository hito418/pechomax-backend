import { hash } from '@node-rs/argon2'
import './env'
import { db } from './db'
import {
  catchPictures,
  DEMO_PASSWORD,
  seedCatches,
  seedCategories,
  seedConversations,
  seedIds,
  seedLevels,
  seedLocations,
  seedMessages,
  seedSpecies,
  seedSpeciesLocations,
  seedUsers,
} from './seedData'

const conversationIdsByKey = {
  annecy: seedIds.conversations.annecy,
  lacanau: seedIds.conversations.lacanau,
  loire: seedIds.conversations.loire,
  mer: seedIds.conversations.mer,
  rhone: seedIds.conversations.rhone,
  truite: seedIds.conversations.truite,
} as const

const MESSAGE_START_MS = Date.parse('2026-04-23T08:00:00.000Z')

function messageTimestamp(index: number) {
  return new Date(MESSAGE_START_MS + index * 47 * 60 * 1000)
}

function catchTimestamp(date: string) {
  return new Date(`${date}T12:00:00.000Z`)
}

async function clearDatabase() {
  await db.deleteFrom('messages').execute()
  await db.deleteFrom('conversations').execute()
  await db.deleteFrom('catches').execute()
  await db.deleteFrom('speciesLocation').execute()
  await db.deleteFrom('locations').execute()
  await db.deleteFrom('species').execute()
  await db.deleteFrom('categories').execute()
  await db.deleteFrom('users').execute()
  await db.deleteFrom('levels').execute()
}

function levelIdForScore(score: number) {
  const level = seedLevels.find(
    (item) => score >= item.start && (item.end === null || score <= item.end)
  )

  return level?.id ?? seedIds.levels.debutant
}

function speciesPointValue(speciesId: string) {
  const species = seedSpecies.find((item) => item.id === speciesId)
  return species?.point_value ?? 1
}

function scoreByUser() {
  return seedCatches.reduce<Record<string, number>>((acc, catchItem) => {
    const score =
      speciesPointValue(catchItem.species_id) *
      catchItem.length *
      catchItem.weight
    acc[catchItem.user_id] = (acc[catchItem.user_id] ?? 0) + score
    return acc
  }, {})
}

async function insertLevels() {
  await db.insertInto('levels').values(seedLevels).execute()
}

async function insertUsers() {
  const hashedPassword = await hash(DEMO_PASSWORD)

  await db
    .insertInto('users')
    .values(
      seedUsers.map((user) => ({
        ...user,
        level_id: seedIds.levels.debutant,
        password: hashedPassword,
        score: 0,
      }))
    )
    .execute()
}

async function insertCategories() {
  await db.insertInto('categories').values(seedCategories).execute()
}

async function insertSpecies() {
  await db.insertInto('species').values(seedSpecies).execute()
}

async function insertLocations() {
  await db.insertInto('locations').values(seedLocations).execute()
}

async function insertSpeciesLocations() {
  await db
    .insertInto('speciesLocation')
    .values(
      seedSpeciesLocations.map(([locationId, speciesId], index) => ({
        id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        location_id: locationId,
        species_id: speciesId,
      }))
    )
    .execute()
}

async function insertCatches() {
  await db
    .insertInto('catches')
    .values(
      seedCatches.map((catchItem) => ({
        date: catchItem.date,
        description: catchItem.description,
        id: catchItem.id,
        length: catchItem.length,
        location_id: catchItem.location_id,
        pictures: [catchPictures[catchItem.pictureIndex % catchPictures.length]],
        point_value:
          speciesPointValue(catchItem.species_id) *
          catchItem.length *
          catchItem.weight,
        species_id: catchItem.species_id,
        user_id: catchItem.user_id,
        created_at: catchTimestamp(catchItem.date),
        updated_at: catchTimestamp(catchItem.date),
        weight: catchItem.weight,
      }))
    )
    .execute()
}

async function updateUserScores() {
  const scores = scoreByUser()

  await Promise.all(
    seedUsers.map((user) => {
      const score = scores[user.id] ?? 0
      return db
        .updateTable('users')
        .set({
          level_id: levelIdForScore(score),
          score,
        })
        .where('id', '=', user.id)
        .execute()
    })
  )
}

async function insertConversations() {
  await db
    .insertInto('conversations')
    .values(
      seedConversations.map((conversation, index) => ({
        ...conversation,
        created_at: messageTimestamp(index * 8),
        updated_at: messageTimestamp(index * 8 + 7),
      }))
    )
    .execute()
}

async function insertMessages() {
  await db
    .insertInto('messages')
    .values(
      seedMessages.map(([conversationKey, userId, content], index) => ({
        content,
        conversation_id: conversationIdsByKey[conversationKey],
        created_at: messageTimestamp(index),
        id: `80000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        pictures: [],
        updated_at: messageTimestamp(index),
        user_id: userId,
      }))
    )
    .execute()
}

type SeedOptions = {
  allowNonDev?: boolean
}

export default async function seedDb(options: SeedOptions = {}) {
  if (process.env.NODE_ENV !== 'DEV' && !options.allowNonDev) {
    console.warn('Skipping seed: deterministic demo seed only runs in DEV.')
    return
  }

  await clearDatabase()
  await insertLevels()
  await insertUsers()
  await insertCategories()
  await insertSpecies()
  await insertLocations()
  await insertSpeciesLocations()
  await insertCatches()
  await updateUserScores()
  await insertConversations()
  await insertMessages()

  console.log(
    [
      'Seeded deterministic PechoMax demo data:',
      `${seedLevels.length} levels`,
      `${seedUsers.length} users`,
      `${seedCategories.length} categories`,
      `${seedSpecies.length} species`,
      `${seedLocations.length} locations`,
      `${seedSpeciesLocations.length} speciesLocation rows`,
      `${seedCatches.length} catches`,
      `${seedConversations.length} conversations`,
      `${seedMessages.length} messages`,
    ].join(' ')
  )
}

async function runCliSeed() {
  if (!process.argv.includes('--confirm-demo-seed')) {
    console.error(
      'Refusing to seed. Re-run with --confirm-demo-seed to replace demo data.'
    )
    process.exit(1)
  }

  await seedDb({ allowNonDev: true })
  await db.destroy()
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runCliSeed().catch(async (error) => {
    console.error(error)
    await db.destroy()
    process.exit(1)
  })
}
