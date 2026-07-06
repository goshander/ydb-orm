import type { LikeType, PrimitiveType, WhereType } from './type'

export const where = (
  seed: WhereType | { or: WhereType },
  paramPrefix: string = 'where',
) => {
  let unit = ' AND '

  const data: WhereType = seed.or ? (seed.or as WhereType) : (seed as WhereType)

  if (seed.or) {
    unit = ' OR '
  }

  const conditions: string[] = []
  const params: Record<string, PrimitiveType> = {}

  let paramIndex = 0

  Object.keys(data).forEach((field) => {
    const whereCondition = data[field]
    const paramName = `${paramPrefix}_${field}_${paramIndex}`

    if (Array.isArray(whereCondition)) {
      // if where is an array
      conditions.push(`${field} IN $${paramName}`)
      params[paramName] = whereCondition
    } else if ((whereCondition as LikeType).like) {
      // if where is an like structure
      const likeCond = (whereCondition as LikeType).like
      conditions.push(`${field} LIKE $${paramName}`)
      params[paramName] = `%${likeCond}%`
    } else {
      // as primitive type
      conditions.push(`${field} = $${paramName}`)
      params[paramName] = whereCondition as PrimitiveType
    }

    paramIndex += 1
  })

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(unit)}` : '',
    params,
  }
}
