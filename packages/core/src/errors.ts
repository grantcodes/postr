export type PostrErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'insufficient_scope'
  | 'forbidden'
  | 'not_found'

const statuses: Record<PostrErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  insufficient_scope: 403,
  forbidden: 403,
  not_found: 404,
}

/** An error with a Micropub error code, mapped to an HTTP status by the Micropub routes. */
export class PostrError extends Error {
  readonly code: PostrErrorCode
  readonly status: number

  constructor(code: PostrErrorCode, message: string) {
    super(message)
    this.name = 'PostrError'
    this.code = code
    this.status = statuses[code]
  }
}
