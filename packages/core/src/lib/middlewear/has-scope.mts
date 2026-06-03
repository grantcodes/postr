import { get } from '../config.mjs'
import type { Request, Response, NextFunction } from 'express'

/**
 * Checks if the current authenticated token contains a specified scope.
 * Automatically handles "post" and "create" as the same thing.
 */
const hasScope = (requiredScope: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const token = get('token')
    if (token && token.scope) {
      const scopes: string[] = token.scope.split(' ')
      let hasScope = scopes.includes(requiredScope)

      // Create and post are equal
      if (requiredScope === 'post' && !hasScope) {
        hasScope = scopes.includes('create')
      }
      if (requiredScope === 'create' && !hasScope) {
        hasScope = scopes.includes('post')
      }

      // All good!
      if (hasScope) {
        return next()
      }
    }

    // No scope, do not continue
    res.status(401).json({
      error: 'insufficient_scope',
      error_description: `The current token does not contain the ${requiredScope} scope`,
      scope: requiredScope,
    })
  }

export default hasScope
