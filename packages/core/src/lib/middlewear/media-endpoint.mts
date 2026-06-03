import saveFile from '../save-file.mjs'
import * as placeholders from '../placeholders.mjs'
import hasScope from './has-scope.mjs'
import type { Request, Response, NextFunction } from 'express'

/**
 * Micropub media endpoint as an express middlewear
 */
export default [
  hasScope('create'),
  (req: Request, res: Response, _next: NextFunction): void => {
    if (!req.file || req.file.truncated || !req.file.buffer) {
      res.status(400)
      res.json({
        error: 'Error with file',
        error_description: 'Error or missing file',
      })
      return
    }

    const filename = req.file.originalname
    // Save file
    saveFile(req.file.buffer, filename)
      .then(url => {
        url = placeholders.replace(url)
        res.status(201)
        res.header('Location', url)
        res.json({
          location: url,
        })
      })
      .catch((err: Error) => {
        console.log('Error writing media endpoint file', err)
        res.status(500)
        res.json({
          error: 'Error saving file',
          error_description:
            'There was an error writing the media file to disk',
        })
      })
  },
]
