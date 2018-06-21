const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const multer = require('multer')

const authMiddlewear = require('./middlewear/auth')
const processMicropubBody = require('./middlewear/process-micropub-body')
const micropubQuery = require('./middlewear/micropub-query')
const micropubActions = require('./middlewear/micropub-actions')
const micropubPost = require('./middlewear/micropub-post')
const mediaEndpoint = require('./middlewear/media-endpoint')

const router = express.Router({
  caseSensitive: true,
  mergeParams: true,
})

const storage = multer.memoryStorage()
const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 },
})

router.use(bodyParser.urlencoded({ extended: true }))
router.use(bodyParser.json())

// Enable cors requests
router.use(cors())
router.options(cors())

// TODO: Enable auth
// router.use(authMiddlewear)

// Micropub queries
router.get('/', micropubQuery)

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
  micropubFilesMiddleware,
  processMicropubBody,
  micropubActions,
  micropubPost
)

// Media endpoint
router.post('/media', upload.single('file'), mediaEndpoint)

module.exports = router
