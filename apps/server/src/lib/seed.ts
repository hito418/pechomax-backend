import { hash } from '@node-rs/argon2'
import './env'
import { db } from './db'
import {
  catchPictures,
  DEMO_PASSWORD,
  seedCatches,
  seedCategories,
  seedConversations,
  seedFavoriteLocations,
  seedIds,
  seedLevels,
  seedLocationComments,
  seedLocationRatings,
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
  await db.deleteFrom('favorite_locations').execute()
  await db.deleteFrom('location_comments').execute()
  await db.deleteFrom('location_ratings').execute()
  await db.deleteFrom('catch_likes').execute()
  await db.deleteFrom('catch_comments').execute()
  await db.deleteFrom('saved_catches').execute()
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

function seedWeightGrams(weight: number) {
  return weight < 100 ? weight * 1000 : weight
}

function scoreWeightUnit(weight: number) {
  return Math.max(1, Math.round(seedWeightGrams(weight) / 1000))
}

function scoreByUser() {
  return seedCatches.reduce<Record<string, number>>((acc, catchItem) => {
    const score =
      speciesPointValue(catchItem.species_id) *
      catchItem.length *
      scoreWeightUnit(catchItem.weight)
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

async function insertLocationSocial() {
  await db
    .insertInto('favorite_locations')
    .values(
      seedFavoriteLocations.map(([locationId, userId], index) => ({
        id: `b1000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        location_id: locationId,
        user_id: userId,
      }))
    )
    .execute()

  await db
    .insertInto('location_ratings')
    .values(
      seedLocationRatings.map(([locationId, userId, rating], index) => ({
        id: `b2000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        location_id: locationId,
        rating,
        user_id: userId,
      }))
    )
    .execute()

  await db
    .insertInto('location_comments')
    .values(
      seedLocationComments.map(([locationId, userId, content], index) => ({
        content,
        id: `b3000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        location_id: locationId,
        user_id: userId,
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
        weight: seedWeightGrams(catchItem.weight),
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

async function insertCatchSocial() {
  const comments = [
    [seedCatches[0].id, seedIds.users.sophie, 'Belle prise, le courant devait etre fort sur ce secteur.'],
    [seedCatches[0].id, seedIds.users.marc, 'Le shad naturel marche tres bien en ce moment.'],
    [seedCatches[1].id, seedIds.users.marc, 'Super poisson, les herbiers du Bourget sont magnifiques.'],
    [seedCatches[3].id, seedIds.users.marc, 'Joli bar, la maree a l air parfaite.'],
    [seedCatches[4].id, seedIds.users.sophie, 'Black-bass propre, remise a l eau nickel.'],
  ] as const

  await db
    .insertInto('catch_comments')
    .values(
      comments.map(([catchId, userId, content], index) => ({
        catch_id: catchId,
        content,
        id: `a1000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        user_id: userId,
      }))
    )
    .execute()

  await db
    .insertInto('catch_likes')
    .values(
      [
        [seedCatches[0].id, seedIds.users.sophie],
        [seedCatches[0].id, seedIds.users.marc],
        [seedCatches[1].id, seedIds.users.marc],
        [seedCatches[3].id, seedIds.users.marc],
        [seedCatches[4].id, seedIds.users.sophie],
      ].map(([catchId, userId], index) => ({
        catch_id: catchId,
        id: `a2000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        user_id: userId,
      }))
    )
    .execute()

  await db
    .insertInto('saved_catches')
    .values(
      [
        [seedCatches[0].id, seedIds.users.marc],
        [seedCatches[1].id, seedIds.users.marc],
        [seedCatches[3].id, seedIds.users.sophie],
      ].map(([catchId, userId], index) => ({
        catch_id: catchId,
        id: `a3000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        user_id: userId,
      }))
    )
    .execute()
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
  await insertLocationSocial()
  await insertCatches()
  await insertCatchSocial()
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
      `${seedFavoriteLocations.length} favorite locations`,
      `${seedLocationRatings.length} location ratings`,
      `${seedLocationComments.length} location comments`,
      `${seedCatches.length} catches`,
      '5 catch likes',
      '5 catch comments',
      '3 saved catches',
      `${seedConversations.length} conversations`,
      `${seedMessages.length} messages`,
    ].join(' ')
  )
}
