const { parse: parseQuerystring } = require('querystring')
const fetch = require('node-fetch')
const config = require('../config')

/**
 * Express middlewear that checks for a valid access token.
 * Can be forced to always accept any request by enabling the "dangerousDevMode"
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {function} next Express next function
 */
module.exports = (req, res, next) => {
  if (config.get('dangerousDevMode') === true) {
    // TODO: I am not at all sure saving the token data in the config is a good idea
    // I do not know if there will be an issue with multiple requests at the same time with different tokens
    // It likely should be contained within the express request somehow. But I want to use it outside of express routes too
    config.set('token', {
      me: config.get('siteBaseUrl'),
      scope: 'post create delete update',
      client_id: 'dangerousDevMode',
    })
    return next()
  }

  let token

  // Check both headers and the body for the access token.
  if (req.headers.authorization) {
    token = req.headers.authorization.trim().split(/\s+/)[1]
  } else if (!token && req.body && req.body.access_token) {
    token = req.body.access_token
    // Delete the token from the body if it exists
    delete req.body.access_token
  }

  if (!token) {
    res.status(401)
    return res.json({
      error: 'invalid_request',
      error_description:
        'Missing "Authorization" header or body "access_token" parameter',
    })
  }

  const fetchOptions = {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': config.get('endpointBaseUrl'),
    },
  }

  // Verify the token with the token endpoint
  fetch(config.get('tokenEndpoint'), fetchOptions)
    .then(response => {
      if (!response.ok) {
        return Promise.reject({ description: 'Invalid token' })
      } else {
        return response.text()
      }
    })
    .then(body => {
      const tokenResponse = parseQuerystring(body)
      if (
        !tokenResponse.me ||
        !tokenResponse.scope ||
        !tokenResponse.client_id
      ) {
        return Promise.reject({
          description: 'Token missing required property',
        })
      }
      if (
        new URL(tokenResponse.me).href !==
        new URL(config.get('siteBaseUrl')).href
      ) {
        return Promise.reject({
          description: 'The token me parameter does not match',
        })
      }
      config.set('token', tokenResponse)
      config.set('rawToken', token)
      next()
    })
    .catch(err => {
      console.log('Error validating token', err)
      res.status(401)
      return res.json({
        error: 'invalid_request',
        error_description: err.description || 'Error validating token',
      })
    })
}
