/**
 * Appends a string to a filename string. (Just looking for the last dot)
 * @param {string} extra The string to append to the filename. A dash is always included before this
 * @param {string} filename The filename
 */
// TODO: I'm sure this could be more robust
module.exports = (extra, filename) => {
  const lastDot = filename.lastIndexOf('.')
  filename =
    filename.substring(0, lastDot) + '-' + extra + filename.substring(lastDot)
  return filename
}
