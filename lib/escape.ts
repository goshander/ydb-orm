import { PrimitiveType } from './type'

const valueEscape = (str: string) => {
  // eslint-disable-next-line no-control-regex
  const regex = /[\0\x08\x09\x1a\n\r"'\\%]/g
  return str.replace(regex, (char) => {
    if (char === '\0') return '\\0'
    if (char === '\x08') return '\\b'
    if (char === '\x09') return '\\t'
    if (char === '\x1a') return '\\z'
    if (char === '\n') return '\\n'
    if (char === '\r') return '\\r'
    if (
      char === '"'
      || char === '\''
      || char === '\\'
      || char === '%'
    ) { return `\\${char}` }
    return char
  })
}

export const escape = (v: PrimitiveType) => {
  if (v == null) return 'NULL'

  if (v instanceof Date) {
    return `Timestamp("${v.toISOString()}")`
  }
  if (typeof v === 'string' || v instanceof String) {
    return `"${valueEscape(v.toString())}"`
  }
  if (typeof v === 'boolean' || v instanceof Boolean) {
    return `${v.toString().toUpperCase()}`
  }
  if ((!!v) && (v.constructor === Array || v.constructor === Object)) {
    return `"${valueEscape(JSON.stringify(v))}"`
  }

  return valueEscape(v.toString())
}
