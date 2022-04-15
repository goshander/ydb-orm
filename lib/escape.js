function vEscape(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\%]/g, (char) => {
    switch (char) {
    case '\0':
      return '\\0'
    case '\x08':
      return '\\b'
    case '\x09':
      return '\\t'
    case '\x1a':
      return '\\z'
    case '\n':
      return '\\n'
    case '\r':
      return '\\r'
    case '"':
    case '\'':
    case '\\':
    case '%':
      return `\\${char}`
    default:
      return char
    }
  })
}

function escape(v) {
  if (v == null) return 'NULL'

  if (v instanceof Date) {
    return `Timestamp("${v.toISOString()}")`
  }
  if (typeof v === 'string' || v instanceof String) {
    return `"${vEscape(v)}"`
  }
  if (typeof v === 'boolean' || v instanceof Boolean) {
    return `${v.toString().toUpperCase()}`
  }
  if ((!!v) && (v.constructor === Array || v.constructor === Object)) {
    return `"${vEscape(JSON.stringify(v))}"`
  }

  return vEscape(v.toString())
}

module.exports = escape
