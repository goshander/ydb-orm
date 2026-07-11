import type {
  ArrayType,
  BetweenType,
  CompareType,
  FindAttributesType,
  FindOrderDirectionType,
  FindOrderType,
  LikeType,
  NotLikeType,
  PrimitiveType,
  WhereOperatorType,
  WhereType,
  YdbSchemaFieldType,
} from './type.js'

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

const operatorSqlMap = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  in: 'IN',
  notIn: 'NOT IN',
} as const

const assertIntegerOption = (
  value: number,
  label: string,
  { min }: { min: number },
) => {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`ydb: invalid ${label} [${value}]`)
  }
}

type QueryBuildState = {
  params: Record<string, PrimitiveType>
  paramIndex: number
}

export const assertIdentifier = (identifier: string, label = 'identifier') => {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`ydb: invalid ${label} [${identifier}]`)
  }
}

export const assertSchemaField = (
  schemaFields: YdbSchemaFieldType,
  field: string,
) => {
  assertIdentifier(field, 'field')

  if (!Object.hasOwn(schemaFields, field)) {
    throw new Error(`ydb: unknown schema field [${field}]`)
  }
}

export const assertLimit = (value: number) => {
  assertIntegerOption(value, 'limit', { min: 1 })
}

export const assertOffset = (value: number) => {
  assertIntegerOption(value, 'offset', { min: 0 })
}

export const assertPage = (value: number) => {
  assertIntegerOption(value, 'page', { min: 1 })
}

export const exportAttributes = (
  schemaFields: YdbSchemaFieldType,
  attributes?: FindAttributesType,
) => {
  if (!attributes) return '*'

  if (Array.isArray(attributes)) {
    const selected = attributes.filter((field) => {
      assertSchemaField(schemaFields, field)
      return true
    })
    return selected.length > 0 ? selected.join(', ') : '*'
  }

  const selected = Object.keys(schemaFields).filter(
    (field) => !attributes.exclude?.includes(field),
  )

  attributes.exclude?.forEach((field) => {
    assertSchemaField(schemaFields, field)
  })

  attributes.include?.forEach((field) => {
    assertSchemaField(schemaFields, field)

    if (!selected.includes(field)) {
      selected.push(field)
    }
  })

  return selected.length > 0 ? selected.join(', ') : '*'
}

export const exportOrder = (
  schemaFields: YdbSchemaFieldType,
  order?: FindOrderType,
) => {
  if (!order) return ''

  const exportDirection = (direction: FindOrderDirectionType) =>
    direction === 'ASC' ? 'ASC' : 'DESC'
  const exportField = ([field, direction]: [
    string,
    FindOrderDirectionType,
  ]) => {
    assertSchemaField(schemaFields, field)
    return `${field} ${exportDirection(direction)}`
  }

  if (typeof order === 'string') {
    assertSchemaField(schemaFields, order)
    return `ORDER BY ${order} DESC`
  }

  const orderItems =
    typeof order[0] === 'string'
      ? [exportField(order as [string, FindOrderDirectionType])]
      : (order as Array<[string, FindOrderDirectionType]>).map(exportField)
  const orderSql = orderItems.filter(Boolean).join(', ')

  return orderSql ? `ORDER BY ${orderSql}` : ''
}

const isWhereOperator = (value: unknown): value is WhereOperatorType => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return Object.keys(operatorSqlMap)
    .concat('like', 'notLike', 'is', 'isNot', 'not', 'between', 'notBetween')
    .some((operator) => operator in value)
}

const buildWhereConditions = (
  schemaFields: YdbSchemaFieldType,
  data: WhereType,
  paramPrefix: string,
  state: QueryBuildState,
): string[] => {
  const conditions: string[] = []

  Object.entries(data).forEach(([field, whereCondition]) => {
    if (whereCondition === undefined) return

    if (field === 'and' || field === 'or') {
      const unit = field === 'and' ? ' AND ' : ' OR '
      const logicalConditions = (
        Array.isArray(whereCondition) ? whereCondition : [whereCondition]
      )
        .flatMap((condition) =>
          buildWhereConditions(
            schemaFields,
            condition as WhereType,
            paramPrefix,
            state,
          ),
        )
        .filter(Boolean)

      if (logicalConditions.length > 0) {
        conditions.push(`(${logicalConditions.join(unit)})`)
      }
      return
    }

    assertSchemaField(schemaFields, field)

    const paramName = `${paramPrefix}_${field}_${state.paramIndex}`

    if (Array.isArray(whereCondition)) {
      conditions.push(`${field} IN $${paramName}`)
      state.params[paramName] = whereCondition as ArrayType
    } else if (isWhereOperator(whereCondition)) {
      if ('like' in whereCondition) {
        const likeCond = (whereCondition as LikeType).like
        conditions.push(`${field} LIKE $${paramName}`)
        state.params[paramName] = `%${likeCond}%`
        state.paramIndex += 1
        return
      }

      if ('notLike' in whereCondition) {
        const likeCond = (whereCondition as NotLikeType).notLike
        conditions.push(`${field} NOT LIKE $${paramName}`)
        state.params[paramName] = `%${likeCond}%`
        state.paramIndex += 1
        return
      }

      if ('not' in whereCondition) {
        const notCond = whereCondition.not

        if (notCond === null) {
          conditions.push(`${field} IS NOT NULL`)
        } else {
          conditions.push(`${field} != $${paramName}`)
          state.params[paramName] = notCond
        }

        state.paramIndex += 1
        return
      }

      if ('between' in whereCondition) {
        const betweenCond = (whereCondition as BetweenType).between

        if (betweenCond) {
          const leftParamName = `${paramPrefix}_${field}_${state.paramIndex}`
          const rightParamName = `${paramPrefix}_${field}_${state.paramIndex + 1}`
          conditions.push(
            `${field} BETWEEN $${leftParamName} AND $${rightParamName}`,
          )
          state.params[leftParamName] = betweenCond[0]
          state.params[rightParamName] = betweenCond[1]
          state.paramIndex += 2
        }

        return
      }

      if ('notBetween' in whereCondition) {
        const betweenCond = (whereCondition as BetweenType).notBetween

        if (betweenCond) {
          const leftParamName = `${paramPrefix}_${field}_${state.paramIndex}`
          const rightParamName = `${paramPrefix}_${field}_${state.paramIndex + 1}`
          conditions.push(
            `${field} NOT BETWEEN $${leftParamName} AND $${rightParamName}`,
          )
          state.params[leftParamName] = betweenCond[0]
          state.params[rightParamName] = betweenCond[1]
          state.paramIndex += 2
        }

        return
      }

      if ('is' in whereCondition) {
        conditions.push(`${field} IS NULL`)
      }

      if ('isNot' in whereCondition) {
        conditions.push(`${field} IS NOT NULL`)
      }

      Object.entries(operatorSqlMap).forEach(([operator, sqlOperator]) => {
        const operatorValue = (whereCondition as CompareType)[
          operator as keyof CompareType
        ]

        if (operatorValue === undefined) return

        const operatorParamName = `${paramPrefix}_${field}_${state.paramIndex}`
        conditions.push(`${field} ${sqlOperator} $${operatorParamName}`)
        state.params[operatorParamName] = operatorValue as
          | PrimitiveType
          | ArrayType
        state.paramIndex += 1
      })

      return
    } else {
      conditions.push(`${field} = $${paramName}`)
      state.params[paramName] = whereCondition as PrimitiveType
    }

    state.paramIndex += 1
  })

  return conditions
}

export const exportWhere = (
  schemaFields: YdbSchemaFieldType,
  seed: WhereType,
  paramPrefix: string = 'where',
) => {
  const state: QueryBuildState = {
    params: {},
    paramIndex: 0,
  }
  const conditions = buildWhereConditions(
    schemaFields,
    seed,
    paramPrefix,
    state,
  )

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params: state.params,
  }
}
