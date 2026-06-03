import express from 'express'
import cors from 'cors'
import multer from 'multer'

import authMiddlewear from './middlewear/auth.mjs'
import processMicropubBody from './middlewear/process-micropub-body.mjs'
import micropubQuery from './middlewear/micropub-query.mjs'
import micropubActions from './middlewear/micropub-actions.mjs'
import micropubPost from './middlewear/micropub-post.mjs'
import mediaEndpoint from './middlewear/media-endpoint.mjs'

const router = express.Router({
  caseSensitive: true,
  mergeParams: true,
})

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
})

router.use(express.urlencoded({ extended: true }))
router.use(express.json())

// Enable cors requests
router.use(cors())
router.options('*', cors())

// Micropub queries
router.get('/', authMiddlewear, micropubQuery)

// Micropub actions & post
const micropubFilesMiddleware = upload.fields([
  { name: 'video' },
  { name: 'video[]' },
  { name: 'audio' },
  { name: 'audio[]' },
  { name: 'photo' },
  { name: 'photo[]' },
])
router.post(
  '/',
  authMiddlewear,
  micropubFilesMiddleware,
  processMicropubBody,
  micropubActions,
  micropubPost,
)

// Media endpoint
router.post('/media', authMiddlewear, upload.single('file'), mediaEndpoint)

export default router
