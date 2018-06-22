const { parse: parseQuerystring } = require('querystring')
const fetch = require('node-fetch')
const config = require('../config')

module.exports = (req, res, next) => {
  // TODO: Enable Super dev mode
  // if (argv.dev) {
  //   return next();
  // }

  let token

  if (req.headers.authorization) {
    token = req.headers.authorization.trim().split(/\s+/)[1]
  } else if (!token && req.body && req.body.access_token) {
    token = req.body.access_token
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
        return Promise.reject({ description: 'Token missing required' })
      } else {
        req.body.token = tokenResponse
        next()
      }
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
