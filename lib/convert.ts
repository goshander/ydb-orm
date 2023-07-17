import {
  YdbPrimitiveTypeId, YdbType, FieldType, JsonType,
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

type Converter = Record<YdbPrimitiveTypeId, (r: RawData)=>FieldType | JsonType>

const CONVERTER: Converter = {
  [YdbType.date]: (r) => new Date(r.uint64Value!.toNumber() / 1000),
  [YdbType.string]: (r) => r.textValue! as string,
  [YdbType.ascii]: (r) => r.bytesValue!.toString(),
  [YdbType.uint64]: (r) => r.uint64Value!.toNumber(),
  [YdbType.uint32]: (r) => r.uint32Value! as number,
  [YdbType.uint8]: (r) => r.uint8Value! as number,
  [YdbType.int64]: (r) => r.int64Value!.toNumber(),
  [YdbType.int32]: (r) => r.int32Value! as number,
  [YdbType.int8]: (r) => r.int8Value! as number,
  [YdbType.bool]: (r) => r.boolValue! as boolean,
  [YdbType.json]: (r) => JSON.parse(r.textValue!) as JsonType,
} as const

type RawFieldType = {
  typeId?: YdbPrimitiveTypeId
  optionalType?: {
    item?:{
      typeId?: YdbPrimitiveTypeId
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
