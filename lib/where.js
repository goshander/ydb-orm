const escape = require('./escape')

function where(seed) {
  let unit = ' AND '

  let data = seed

  if (data.or) {
    data = data.or
    unit = ' OR '
  }

  const w = Object.keys(data).map((f) => {
    if (!!data[f] && data[f].constructor === Array) {
      return `${f} IN (${data[f].map((v) => escape(v))})`
    }
    if (!!data[f] && data[f].constructor === Object && data[f].like) {
      return `${f} LIKE ${escape(`%${data[f].like}%`)}`
    }
    return `${f} = ${escape(data[f])}`
  })

  if (w.length > 0) {
    return `WHERE ${w.join(unit)}`
  }

  return ''
}

module.exports = where
