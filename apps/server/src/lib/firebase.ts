import { initializeApp } from 'firebase/app'
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { v4 as uuidv4 } from 'uuid'

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
}
// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const storage = getStorage(app)

async function uploadImage(file: File, path: string) {
  const name = uuidv4()
  const extension = file.type.split('/').at(-1)
  const storageRef = ref(storage, `${path}/${name}.${extension}`)
  const uploadTask = await uploadBytes(storageRef, file)

  return getDownloadURL(uploadTask.ref)
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
