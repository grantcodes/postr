import { get as getCollection } from '../db.mjs'
import hasScope from './has-scope.mjs'
import type { Request, Response, NextFunction } from 'express'

/**
 * Handle creating micropub posts via an express middlewear
 */
export default [
  hasScope('create'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    if (
      req.body.micropub &&
      req.body.micropub.properties &&
      req.body.micropub.type
    ) {
      try {
        const micropub = req.body.micropub
        const collection = await getCollection()
        const doc = await collection.insert(micropub)

        // Successfully added to the database
        res.status(201)
        res.header('Location', doc.getPermalink())
        res.json({ location: doc.getPermalink(), item: doc.toMf2() })
        return
      } catch (err) {
        console.error('[Error creating new post]', err)
        res.status(500).json({
          error: 'internal_server_error',
          error_description: 'Error creating post',
        })
        return
      }
    } else {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing micropub post data',
      })
      return
    }
  },
]
