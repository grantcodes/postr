const config = require('../config')

/**
 * Checks if the current authenticated token contains a specified scope. Automatically handles "post" and "create" as the same thing
 * @param {string} requiredScope The scope to check
 */
const hasScope = requiredScope => (req, res, next) => {
  const token = config.get('token')
  if (token && token.scope) {
    const scopes = token.scope.split(' ')
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
  return res.status(401).json({
    error: 'insufficient_scope',
    error_description: `The current token does not contain the ${requiredScope} scope`,
    scope: requiredScope,
  })
}

module.exports = hasScope
