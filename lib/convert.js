const { Ydb } = require('ydb-sdk')

const CONVERTER = {
  [Ydb.Type.PrimitiveTypeId.TIMESTAMP]: (r) => new Date(r.uint64Value.toNumber() / 1000),
  [Ydb.Type.PrimitiveTypeId.UTF8]: (r) => r.textValue,
  [Ydb.Type.PrimitiveTypeId.STRING]: (r) => r.bytesValue.toString(),
  [Ydb.Type.PrimitiveTypeId.UINT64]: (r) => r.uint64Value.toNumber(),
  [Ydb.Type.PrimitiveTypeId.UINT32]: (r) => r.uint32Value,
  [Ydb.Type.PrimitiveTypeId.UINT8]: (r) => r.uint8Value,
  [Ydb.Type.PrimitiveTypeId.INT64]: (r) => r.int64Value.toNumber(),
  [Ydb.Type.PrimitiveTypeId.INT32]: (r) => r.int32Value,
  [Ydb.Type.PrimitiveTypeId.INT8]: (r) => r.int8Value,
  [Ydb.Type.PrimitiveTypeId.BOOL]: (r) => r.boolValue,
  [Ydb.Type.PrimitiveTypeId.JSON]: (r) => JSON.parse(r.textValue),
}

function convert(row, type) {
  if (Object.keys(row).includes('nullFlagValue')) return null

  let typeId = null
  if (type.typeId) {
    typeId = type.typeId
  } else {
    typeId = type.optionalType.item.typeId
  }

  const converter = CONVERTER[typeId]

  if (!converter) {
    throw new Error(`ydb: unsupported type id: ${typeId}, row: ${Object.keys(row).pop()}`)
  }

  return converter(row)
}

module.exports = convert
