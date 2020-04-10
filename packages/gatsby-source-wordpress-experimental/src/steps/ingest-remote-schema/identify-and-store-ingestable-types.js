import store from "~/store"
import { typeIsExcluded } from "~/steps/ingest-remote-schema/is-excluded"

const identifyAndStoreIngestableFieldsAndTypes = async () => {
  const nodeListFilter = field => field.name === `nodes`

  const state = store.getState()
  const { introspectionData, fieldBlacklist } = state.remoteSchema
  const { helpers, pluginOptions } = state.gatsbyApi

  const cachedFetchedTypes = await helpers.cache.get(`previously-fetched-types`)

  if (cachedFetchedTypes) {
    const restoredFetchedTypesMap = new Map(cachedFetchedTypes)

    store.dispatch.remoteSchema.setState({
      fetchedTypes: restoredFetchedTypesMap,
    })
  }

  const typeMap = new Map(
    introspectionData.__schema.types.map(type => [type.name, type])
  )

  if (pluginOptions.type) {
    Object.entries(pluginOptions.type).forEach(([typeName, typeSettings]) => {
      // our lazy types won't initially be fetched,
      // so we need to mark them as fetched here
      if (
        typeSettings.lazyNodes &&
        !typeIsExcluded({ pluginOptions, typeName })
      ) {
        const lazyType = typeMap.get(typeName)
        store.dispatch.remoteSchema.addFetchedType(lazyType)
      }
    })
  }

  const interfaces = introspectionData.__schema.types.filter(
    type => type.kind === `INTERFACE`
  )

  for (const interfaceType of interfaces) {
    if (typeIsExcluded({ pluginOptions, typeName: interfaceType.name })) {
      continue
    }

    store.dispatch.remoteSchema.addFetchedType(interfaceType)

    if (interfaceType.fields) {
      for (const interfaceField of interfaceType.fields) {
        if (interfaceField.type) {
          store.dispatch.remoteSchema.addFetchedType(interfaceField.type)
        }
      }
    }
  }

  const rootFields = typeMap.get(`RootQuery`).fields

  const nodeInterfaceTypes = []
  const nodeListRootFields = []
  const nonNodeRootFields = []

  for (const field of rootFields) {
    const fieldHasNonNullArgs = field.args.some(
      arg => arg.type.kind === `NON_NULL`
    )

    if (fieldHasNonNullArgs) {
      // we can't know what those args should be, so skip this field
      continue
    }

    if (typeIsExcluded({ pluginOptions, typeName: field.type.name })) {
      continue
    }

    if (field.type.kind === `OBJECT`) {
      const type = typeMap.get(field.type.name)

      const nodeField = type.fields.find(nodeListFilter)

      if (nodeField && nodeField.type.ofType.kind === `INTERFACE`) {
        const nodeListField = type.fields.find(nodeListFilter)

        if (nodeListField) {
          nodeInterfaceTypes.push(nodeListField.type.ofType.name)

          store.dispatch.remoteSchema.addFetchedType(nodeListField.type)

          const nodeListFieldType = typeMap.get(nodeListField.type.ofType.name)

          for (const innerField of nodeListFieldType.fields) {
            store.dispatch.remoteSchema.addFetchedType(innerField.type)
          }

          continue
        }
      } else if (nodeField) {
        if (fieldBlacklist.includes(field.name)) {
          continue
        }

        store.dispatch.remoteSchema.addFetchedType(nodeField.type)

        nodeListRootFields.push(field)
        continue
      }
    }

    if (fieldBlacklist.includes(field.name)) {
      continue
    }

    store.dispatch.remoteSchema.addFetchedType(field.type)
    nonNodeRootFields.push(field)
  }

  const nodeListFieldNames = nodeListRootFields.map(field => field.name)

  const nodeListTypeNames = nodeListRootFields.map(field => {
    const connectionType = typeMap.get(field.type.name)

    const nodesField = connectionType.fields.find(nodeListFilter)
    return nodesField.type.ofType.name
  })

  const gatsbyNodesInfo = {
    fieldNames: nodeListFieldNames,
    typeNames: nodeListTypeNames,
  }

  store.dispatch.remoteSchema.setState({
    typeMap,
    gatsbyNodesInfo,
    ingestibles: {
      nodeListRootFields,
      nonNodeRootFields,
      nodeInterfaceTypes,
    },
  })
}

export { identifyAndStoreIngestableFieldsAndTypes }
