module.exports = (extra, filename) => {
  const lastDot = filename.lastIndexOf('.')
  filename =
    filename.substring(0, lastDot) + '-' + extra + filename.substring(lastDot)
  return filename
}
