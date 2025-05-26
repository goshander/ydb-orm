import { fromJs } from '@ydbjs/value'

import { LikeType, PrimitiveType, WhereType } from './type'

export const buildWhereWithParams = (seed: WhereType | { or: WhereType }, paramPrefix: string = 'where') => {
  let unit = ' AND '

  const data: WhereType = seed.or ? seed.or as WhereType : seed as WhereType

  if (seed.or) {
    unit = ' OR '
  }

  const conditions: string[] = []
  const params: Record<string, any> = {}
  let paramIndex = 0

  Object.keys(data).forEach((field) => {
    const whereCond = data[field]

    if (Array.isArray(whereCond)) {
      const paramName = `${paramPrefix}_${field}_${paramIndex}`
      paramIndex += 1
      conditions.push(`${field} IN $${paramName}`)
      params[`$${paramName}`] = fromJs(whereCond)
    } else if ((whereCond as LikeType).like) {
      const likeCond = (whereCond as LikeType).like
      const paramName = `${paramPrefix}_${field}_${paramIndex}`
      paramIndex += 1
      conditions.push(`${field} LIKE $${paramName}`)
      params[`$${paramName}`] = fromJs(`%${likeCond}%`)
    } else {
      const paramName = `${paramPrefix}_${field}_${paramIndex}`
      paramIndex += 1
      conditions.push(`${field} = $${paramName}`)
      params[`$${paramName}`] = fromJs(whereCond as PrimitiveType)
    }
  })

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(unit)}` : '',
    params,
  }
}

// Обратная совместимость - старая функция where для случаев, где еще используется escape
export const where = (seed: WhereType | { or: WhereType }) => {
  const { clause } = buildWhereWithParams(seed)
  return clause
}
