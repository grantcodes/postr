const config = require('./config')

/**
 * Checks if the current authenticated token contains a specified scope. Automatically handles "post" and "create" as the same thing
 * @param {string} scopeToCheck The scope to check
 */
module.exports = function(scopeToCheck) {
  const token = config.get('token')
  if (token && token.scope) {
    const scopes = token.scope.split(' ')
    if (scopeToCheck == 'post' || scopeToCheck == 'create') {
      return this('post') || this('create')
    }
    return scopes.indexOf(scopeToCheck) > -1 ? true : false
  } else {
    return false
  }
}
