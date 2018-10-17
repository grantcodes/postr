module.exports =
  (process &&
    process.env &&
    process.env.BUILD_TARGET &&
    process.env.BUILD_TARGET === 'server') ||
  typeof window === 'undefined'
