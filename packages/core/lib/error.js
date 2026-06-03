class MicropubError extends Error {
  constructor({ status = null, error = null, message = '' }) {
    // Pass message to parent constructor
    super(message)

    // Custom debugging information
    this.status = status
    this.error = error
  }
}

module.exports = MicropubError
