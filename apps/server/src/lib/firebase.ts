import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { v4 as uuidv4 } from 'uuid'

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })

const bucket = getStorage(app).bucket()

async function uploadImage(file: File, path: string) {
  const name = uuidv4()
  const extension = file.type.split('/').at(-1)
  const objectPath = `${path}/${name}.${extension}`
  const downloadToken = uuidv4()

  await bucket.file(objectPath).save(Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  })

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`
}

export async function uploadProfile(file: File) {
  return uploadImage(file, 'profilePic')
}

export async function uploadMessage(file: File) {
  return uploadImage(file, 'message')
}

export async function uploadCatch(file: File) {
  return uploadImage(file, 'catch')
}
