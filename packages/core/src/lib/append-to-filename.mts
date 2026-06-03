/**
 * Appends a string to a filename string (looking for the last dot).
 */
export default function appendToFilename(
  extra: string | number,
  filename: string,
): string {
  const lastDot = filename.lastIndexOf('.')
  return (
    filename.substring(0, lastDot) + '-' + extra + filename.substring(lastDot)
  )
}
