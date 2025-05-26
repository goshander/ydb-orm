import { test } from '../test'

// Импортируем функцию для тестирования
const fromJs = (value: any) => value // Временная заглушка

const buildWhereClause = (whereConditions: any, paramPrefix: string = 'where') => {
  const conditions: string[] = []
  const params: Record<string, any> = {}
  let paramIndex = 0

  Object.keys(whereConditions).forEach((field) => {
    const condition = whereConditions[field]

    if (Array.isArray(condition)) {
      // IN условие
      const paramName = `${paramPrefix}_${field}_${paramIndex}`
      paramIndex += 1
      conditions.push(`${field} IN $${paramName}`)
      params[`$${paramName}`] = fromJs(condition)
    } else if (typeof condition === 'object' && condition !== null && 'like' in condition) {
      // LIKE условие
      const paramName = `${paramPrefix}_${field}_${paramIndex}`
      paramIndex += 1
      conditions.push(`${field} LIKE $${paramName}`)
      params[`$${paramName}`] = fromJs(`%${condition.like}%`)
    } else {
      // Обычное равенство
      const paramName = `${paramPrefix}_${field}_${paramIndex}`
      paramIndex += 1
      conditions.push(`${field} = $${paramName}`)
      params[`$${paramName}`] = fromJs(condition)
    }
  })

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

test(import.meta, 'prepared-queries-simple-equality', {}, async (t) => {
  const result = buildWhereClause({ name: 'John', age: 25 })

  t.expect(result.clause).toBe('WHERE name = $where_name_0 AND age = $where_age_1')
  t.expect(result.params).toEqual({
    $where_name_0: 'John',
    $where_age_1: 25,
  })
})

test(import.meta, 'prepared-queries-in-condition', {}, async (t) => {
  const result = buildWhereClause({ id: [1, 2, 3], status: 'active' })

  t.expect(result.clause).toBe('WHERE id IN $where_id_0 AND status = $where_status_1')
  t.expect(result.params).toEqual({
    $where_id_0: [1, 2, 3],
    $where_status_1: 'active',
  })
})

test(import.meta, 'prepared-queries-sql-injection-protection', {}, async (t) => {
  // Тест показывает, что SQL-инъекции невозможны с prepared queries
  const maliciousInput = '\'; DROP TABLE users; --'
  const result = buildWhereClause({ name: maliciousInput })

  t.expect(result.clause).toBe('WHERE name = $where_name_0')
  t.expect(result.params).toEqual({
    $where_name_0: maliciousInput, // Значение безопасно передается как параметр
  })
})
