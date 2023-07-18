import {
  FieldType, JsonType, YdbDataType, YdbDataTypeId,
} from './type'

type RawData = {
  uint8Value?: number;
  uint32Value?: number;
  uint64Value?: Long;
  int8Value?: number;
  int32Value?: number;
  int64Value?: Long;
  boolValue?: boolean;
  nullFlagValue?: null;
  bytesValue?: Buffer;
  textValue?: string;
}

type Converter = Record<YdbDataTypeId, (r: RawData)=> FieldType | JsonType>

const CONVERTER: Converter = {
  [YdbDataType.date]: (r) => new Date(r.uint64Value!.toNumber() / 1000),
  [YdbDataType.string]: (r) => r.textValue! as string,
  [YdbDataType.ascii]: (r) => r.bytesValue!.toString(),
  [YdbDataType.uint64]: (r) => r.uint64Value!.toNumber(),
  [YdbDataType.uint32]: (r) => r.uint32Value! as number,
  [YdbDataType.uint8]: (r) => r.uint8Value! as number,
  [YdbDataType.int64]: (r) => r.int64Value!.toNumber(),
  [YdbDataType.int32]: (r) => r.int32Value! as number,
  [YdbDataType.int8]: (r) => r.int8Value! as number,
  [YdbDataType.bool]: (r) => r.boolValue! as boolean,
  [YdbDataType.json]: (r) => JSON.parse(r.textValue!) as JsonType,
} as const

type RawFieldType = {
  typeId?: YdbDataTypeId
  optionalType?: {
    item?: {
      typeId?: YdbDataTypeId
    }
  }
}

export const convert = (row: RawData, type: RawFieldType) => {
  if (Object.keys(row).includes('nullFlagValue')) return null

  const typeId = type.optionalType?.item?.typeId || type.typeId

  if (!typeId) {
    throw new Error(`ydb: type id not found, row: ${Object.keys(row).pop()}`)
  }

  const converter = CONVERTER[typeId]

  if (!converter) {
    throw new Error(`ydb: unsupported type id: ${typeId}, row: ${Object.keys(row).pop()}`)
  }

  return converter(row)
}
