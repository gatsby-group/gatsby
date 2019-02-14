// @flow

const {
  getNamedType,
  getNullableType,
  GraphQLInputObjectType,
  GraphQLList,
} = require(`graphql`)

const getSortOrderEnum = ({ schemaComposer }) =>
  schemaComposer.getOrCreateETC(`SortOrderEnum`, etc => {
    etc.setFields({
      ASC: { value: `ASC` },
      DESC: { value: `DESC` },
    })
  })

const getFieldsEnum = ({ schemaComposer, typeComposer, inputTypeComposer }) => {
  const typeName = typeComposer.getTypeName()
  return schemaComposer.getOrCreateETC(`${typeName}FieldsEnum`, etc => {
    const fields = convert(inputTypeComposer.getFields())
    etc.addFields(fields)
  })
}

const getSortInput = ({ schemaComposer, typeComposer }) => {
  const inputTypeComposer = typeComposer.getInputTypeComposer()
  const SortOrderEnumTC = getSortOrderEnum({ schemaComposer })
  const FieldsEnumTC = getFieldsEnum({
    schemaComposer,
    typeComposer,
    inputTypeComposer,
  })
  const typeName = typeComposer.getTypeName()

  return schemaComposer.getOrCreateITC(`${typeName}SortInput`, itc => {
    itc.addFields({
      fields: [FieldsEnumTC],
      order: { type: [SortOrderEnumTC], defaultValue: [`ASC`] },
    })
  })
}

module.exports = { getSortInput, getFieldsEnum, getSortOrderEnum }

const MAX_SORT_DEPTH = 3
const SORT_FIELD_DELIMITER = `___`

const convert = (fields, prefix = null, depth = 0) => {
  const sortFields = {}

  Object.keys(fields).forEach(fieldName => {
    const fieldConfig = fields[fieldName]
    const sortKey = prefix ? `${prefix}.${fieldName}` : fieldName
    const sortKeyFieldName = sortKey.split(`.`).join(SORT_FIELD_DELIMITER)

    // XXX(freiksenet): this is to preserve legacy behaviour, this probably doesn't actually sort
    if (getNullableType(fieldConfig.type) instanceof GraphQLList) {
      sortFields[sortKeyFieldName] = {
        value: sortKey,
      }
    }

    const type = getNamedType(fieldConfig.type)
    if (type instanceof GraphQLInputObjectType) {
      if (depth < MAX_SORT_DEPTH) {
        Object.assign(sortFields, convert(type.getFields(), sortKey, depth + 1))
      }
    } else {
      // GraphQLScalarType || GraphQLEnumType
      sortFields[sortKeyFieldName] = {
        value: sortKey,
      }
    }
  })
  return sortFields
}
