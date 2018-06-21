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
    // TODO: Load the bad request function
    res.status(401)
    return res.json({
      error: 'invalid_request',
      error_description: 'Missing "Authorization" header or body parameter',
    })
  }

  const requestOptions = {
    method: 'GET',
    // TODO: get user domain
    url: config.get('tokenEndpoint'),
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': config.get('endpointBaseUrl'),
    },
  }

  // TODO: Use fetch or axios?
  request(requestOptions, (err, response, body) => {
    const result = qs.parse(body)
    if (!result.scope || err) {
      res.status(401)
      return res.json({
        error: 'invalid_request',
        error_description: 'Invalid token',
      })
    }

    // if (result.me.replace(/\/$/, '') != config.get('baseUrl').replace(/\/$/, '')) {
    //   console.log(
    //     'Token "me" didn\'t match: "' +
    //       config.get('me').replace(/\/$/, '') +
    //       '", Got: "' +
    //       result.me.replace(/\/$/, '') +
    //       '"'
    //   )
    //   res.status(400)
    //   return res.json({
    //     error: 'invalid_request',
    //     error_description: `Token "me" didn't match any valid reference. Got: "${result.me.replace(
    //       /\/$/,
    //       ''
    //     )}"`,
    //   })
    // }

    next()
  })
}
