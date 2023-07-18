import { escape } from './escape'
import { LikeType, PrimitiveType, WhereType } from './type'

export const where = (seed: WhereType | { or: WhereType }) => {
  let unit = ' AND '

  const data: WhereType = seed.or ? seed.or as WhereType : seed as WhereType

  if (seed.or) {
    unit = ' OR '
  }

  const w = Object.keys(data).map((f) => {
    const whereCond = data[f]

    if (Array.isArray(whereCond)) {
      return `${f} IN (${whereCond.map((v) => escape(v))})`
    }
    if ((whereCond as LikeType).like) {
      const likeCond = (whereCond as LikeType).like
      return `${f} LIKE ${escape(`%${likeCond}%`)}`
    }
    return `${f} = ${escape(whereCond as PrimitiveType)}`
  })

  if (w.length > 0) {
    return `WHERE ${w.join(unit)}`
  }

  return ''
}
