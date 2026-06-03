export interface MicropubErrorOptions {
  status?: number | null
  error?: string | null
  message?: string
}

export default class MicropubError extends Error {
  status: number | null
  error: string | null

  constructor(
    { status = null, error = null, message = '' }: MicropubErrorOptions = {},
  ) {
    super(message)
    this.status = status
    this.error = error
  }
}
