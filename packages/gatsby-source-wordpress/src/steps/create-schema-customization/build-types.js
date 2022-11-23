import store from "~/store"
import { transformFields } from "./transform-fields"
import { typeIsExcluded } from "~/steps/ingest-remote-schema/is-excluded"
import {
  buildTypeName,
  fieldOfTypeWasFetched,
  getTypeSettingsByType,
  filterTypeDefinition,
  getTypesThatImplementInterfaceType,
} from "./helpers"

const unionType = typeBuilderApi => {
  const { schema, type, pluginOptions } = typeBuilderApi

  const types = type.possibleTypes
    .filter(
      possibleType =>
        !typeIsExcluded({
          pluginOptions,
          typeName: possibleType.name,
        })
    )
    .map(possibleType => buildTypeName(possibleType.name))

  if (!types || !types.length) {
    return false
  }

  let unionType = {
    name: buildTypeName(type.name),
    types,
    resolveType: node => {
      if (node.__typename) {
        return buildTypeName(node.__typename)
      }

      return null
    },
    extensions: {
      infer: false,
    },
  }

  // @todo add this as a plugin option
  unionType = filterTypeDefinition(unionType, typeBuilderApi, `UNION`)

  return schema.buildUnionType(unionType)
}

const interfaceType = typeBuilderApi => {
  const { type, schema } = typeBuilderApi

  const state = store.getState()
  const { ingestibles } = state.remoteSchema
  const { nodeInterfaceTypes } = ingestibles

  const implementingTypes = getTypesThatImplementInterfaceType(type)

  const transformedFields = transformFields({
    parentInterfacesImplementingTypes: implementingTypes,
    parentType: type,
    fields: type.fields,
  })

  if (!transformedFields) {
    return null
  }

  let typeDef = {
    name: buildTypeName(type.name),
    fields: transformedFields,
    extensions: { infer: false },
  }

  // if this is a node interface type
  if (nodeInterfaceTypes.includes(type.name)) {
    // we add nodeType (post type) to all nodes as they're fetched
    // so we can add them to node interfaces as well in order to filter
    // by a couple different content types
    typeDef.fields[`nodeType`] = `String`
    typeDef.interfaces = [`Node`]
  } else {
    // otherwise this is a regular interface type so we need to resolve the type name
    typeDef.resolveType = node =>
      node?.__typename ? buildTypeName(node.__typename) : null
  }

  // @todo add this as a plugin option
  typeDef = filterTypeDefinition(typeDef, typeBuilderApi, `INTERFACE`)

  return schema.buildInterfaceType(typeDef)
}

const objectType = typeBuilderApi => {
  const {
    type,
    gatsbyNodeTypes,
    fieldAliases,
    fieldBlacklist,
    schema,
    isAGatsbyNode,
  } = typeBuilderApi

  const transformedFields = transformFields({
    fields: type.fields,
    parentType: type,
    gatsbyNodeTypes,
    fieldAliases,
    fieldBlacklist,
  })

  // if all child fields are excluded, this type shouldn't exist.
  // check null first, otherwise cause:
  // TypeError: Cannot convert undefined or null to object at Function.keys (<anonymous>)
  // Also cause wordpress blog site build failure in createSchemaCustomization step
  if (!transformedFields || !Object.keys(transformedFields).length) {
    return false
  }

  let objectType = {
    name: buildTypeName(type.name),
    fields: transformedFields,
    description: type.description,
    extensions: {
      infer: false,
    },
  }

  if (type.interfaces) {
    objectType.interfaces = type.interfaces
      .filter(interfaceType => {
        const interfaceTypeSettings = getTypeSettingsByType(interfaceType)

        return (
          !interfaceTypeSettings.exclude &&
          fieldOfTypeWasFetched(type) &&
          fieldOfTypeWasFetched(interfaceType)
        )
      })
      .map(({ name }) => buildTypeName(name))
  }

  if (
    gatsbyNodeTypes.includes(type.name) ||
    isAGatsbyNode ||
    // this accounts for Node types that weren't fetched because
    // they have no root field to fetch a single node of this type
    // removing them from the schema breaks the build though
    // @todo instead, if a node type isn't fetched, remove it
    // from the entire schema
    type?.interfaces?.find(({ name }) => name === `Node`)
  ) {
    // this is used to filter the node interfaces
    // by different content types (post types)
    objectType.fields[`nodeType`] = `String`

    objectType.interfaces = [`Node`, ...objectType.interfaces]
  }

  // @todo add this as a plugin option
  objectType = filterTypeDefinition(objectType, typeBuilderApi, `OBJECT`)

  return schema.buildObjectType(objectType)
}

const enumType = ({ schema, type }) =>
  schema.buildEnumType({
    name: buildTypeName(type.name),
    values: type.enumValues.reduce((accumulator, { name }) => {
      accumulator[name] = { name }

      return accumulator
    }, {}),
    description: type.description,
  })

export default { unionType, interfaceType, objectType, enumType }
