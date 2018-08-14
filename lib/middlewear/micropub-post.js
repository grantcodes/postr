const Collection = require('../db')

/**
 * Handle creating micropub posts via an express middlewear
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {function} next Express next function
 */
module.exports = async (req, res, next) => {
  if (
    req.body.micropub &&
    req.body.micropub.properties &&
    req.body.micropub.type
  ) {
    let micropub = req.body.micropub
    const collection = await Collection.get()

    collection
      .insert(micropub)
      .then(doc => {
        // Successfully added to the database
        res.status(201)
        res.header('Location', doc.getPermalink())
        return res.json({ location: doc.getPermalink() })
      })
      .catch(err => {
        console.log('Error creating new post:', err)
        res.status(500)
        return res.json({
          error_description: 'Error creating post',
        })
      })
  } else {
    next()
  }
}
