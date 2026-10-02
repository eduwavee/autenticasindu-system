import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'
import { db } from '../db'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})
