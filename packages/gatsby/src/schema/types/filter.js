const {
  getNamedType,
  getNullableType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLList,
} = require(`graphql`)

const convert = ({ schemaComposer, inputTypeComposer }) => {
  const inputTypeName = inputTypeComposer
    .getTypeName()
    .replace(/Input$/, `FilterInput`)
  if (schemaComposer.has(inputTypeName)) {
    return schemaComposer.get(inputTypeName)
  }

  const convertedITC = new schemaComposer.InputTypeComposer(
    new GraphQLInputObjectType({
      name: inputTypeName,
      fields: {},
    })
  )

  schemaComposer.add(convertedITC)

  const fieldNames = inputTypeComposer.getFieldNames()
  const convertedFields = {}
  fieldNames.forEach(fieldName => {
    const fieldConfig = inputTypeComposer.getFieldConfig(fieldName)
    const type = getNamedType(fieldConfig.type)

    if (type instanceof GraphQLInputObjectType) {
      const itc = new schemaComposer.InputTypeComposer(type)

      const operatorsInputTC = convert({
        schemaComposer,
        inputTypeComposer: itc,
      })

      // TODO: array of arrays?
      const isListType =
        getNullableType(fieldConfig.type) instanceof GraphQLList

      // elemMatch operator
      convertedFields[fieldName] = isListType
        ? getQueryOperatorListInput({
            schemaComposer,
            type: type,
            inputTypeComposer: operatorsInputTC,
          })
        : operatorsInputTC
    } else {
      // GraphQLScalarType || GraphQLEnumType
      const operatorFields = getQueryOperatorInput({ schemaComposer, type })
      if (operatorFields) {
        convertedFields[fieldName] = operatorFields
      }
    }
  })

  convertedITC.addFields(convertedFields)
  return convertedITC
}

const removeEmptyFields = (
  { schemaComposer, inputTypeComposer },
  cache = new Set()
) => {
  const convert = itc => {
    if (cache.has(itc)) {
      return itc
    }
    cache.add(itc)
    const fields = itc.getFields()
    const nonEmptyFields = {}
    Object.keys(fields).forEach(fieldName => {
      const fieldITC = fields[fieldName]
      if (fieldITC instanceof schemaComposer.InputTypeComposer) {
        const convertedITC = convert(fieldITC)
        if (convertedITC.getFieldNames().length) {
          nonEmptyFields[fieldName] = convertedITC
        }
      } else {
        nonEmptyFields[fieldName] = fieldITC
      }
    })
    itc.setFields(nonEmptyFields)
    return itc
  }
  return convert(inputTypeComposer)
}

const getFilterInput = ({ schemaComposer, typeComposer }) => {
  const inputTypeComposer = typeComposer.getInputTypeComposer()
  const filterInputTC = convert({
    schemaComposer,
    inputTypeComposer,
  })
  // Filter out any fields whose type has no query operator fields.
  // This will be the case if the input type has only had fields whose types
  // don't define query operators, e.g. a input type with JSON fields only.
  // We cannot already filter this out further above, because we need
  // to handle circular definitions, e.g. like in `NodeInput`.
  // NOTE: We can remove this if we can guarantee that every type has query
  // operators.
  return removeEmptyFields({ schemaComposer, inputTypeComposer: filterInputTC })
}

module.exports = { getFilterInput }

const EQ = `eq`
const NE = `ne`
const GT = `gt`
const GTE = `gte`
const LT = `lt`
const LTE = `lte`
const IN = `in`
const NIN = `nin`
const REGEX = `regex`
const GLOB = `glob`

const ALLOWED_OPERATORS = {
  Boolean: [EQ, NE, IN, NIN],
  Date: [EQ, NE, GT, GTE, LT, LTE, IN, NIN],
  Float: [EQ, NE, GT, GTE, LT, LTE, IN, NIN],
  ID: [EQ, NE, IN, NIN],
  Int: [EQ, NE, GT, GTE, LT, LTE, IN, NIN],
  String: [EQ, NE, IN, NIN, REGEX, GLOB],
  Enum: [EQ, NE, IN, NIN],
}

const ARRAY_OPERATORS = [IN, NIN]

const getOperatorFields = (fieldType, operators) => {
  const result = {}
  operators.forEach(op => {
    if (ARRAY_OPERATORS.includes(op)) {
      result[op] = [fieldType]
    } else {
      result[op] = fieldType
    }
  })
  return result
}

const getQueryOperatorInput = ({ schemaComposer, type }) => {
  let typeName
  if (type instanceof GraphQLEnumType) {
    typeName = `Enum`
  } else {
    typeName = type.name
  }
  const operators = ALLOWED_OPERATORS[typeName]
  if (operators) {
    return schemaComposer.getOrCreateITC(
      type.name + `QueryOperatorInput`,
      itc => itc.addFields(getOperatorFields(type, operators))
    )
  } else {
    return null
  }
}

const getQueryOperatorListInput = ({ schemaComposer, inputTypeComposer }) => {
  const typeName = inputTypeComposer.getTypeName().replace(/Input/, `ListInput`)
  return schemaComposer.getOrCreateITC(typeName, itc => {
    itc.addFields({
      elemMatch: inputTypeComposer,
    })
  })
}
