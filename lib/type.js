const { Ydb } = require('ydb-sdk')

module.exports = {
  date: Ydb.Type.PrimitiveTypeId.TIMESTAMP,
  string: Ydb.Type.PrimitiveTypeId.UTF8,
  ascii: Ydb.Type.PrimitiveTypeId.STRING,
  int: Ydb.Type.PrimitiveTypeId.INT32,
  int32: Ydb.Type.PrimitiveTypeId.INT32,
  int64: Ydb.Type.PrimitiveTypeId.INT64,
  uint: Ydb.Type.PrimitiveTypeId.UINT32,
  uint64: Ydb.Type.PrimitiveTypeId.UINT64,
  uint8: Ydb.Type.PrimitiveTypeId.UINT8,
  bool: Ydb.Type.PrimitiveTypeId.BOOL,
  json: Ydb.Type.PrimitiveTypeId.JSON,
}
