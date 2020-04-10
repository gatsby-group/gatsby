import { availablePostTypesQuery } from "~/utils/graphql-queries"
import fetchGraphql from "~/utils/fetch-graphql"

import recursivelyTransformFields from "./recursively-transform-fields"
import {
  buildNodesQueryOnFieldName,
  buildNodeQueryOnFieldName,
  buildSelectionSet,
} from "./build-query-on-field-name"

import store from "~/store"
import { getTypeSettingsByType } from "~/steps/create-schema-customization/helpers"

/**
 * generateNodeQueriesFromIngestibleFields
 *
 * Takes in data from an introspection query and
 * processes it to build GraphQL query strings/info
 *
 * @param {object} introspectionData
 * @returns {Object} GraphQL query info including gql query strings
 */
const generateNodeQueriesFromIngestibleFields = async () => {
  const { remoteSchema } = store.getState()

  const {
    fieldBlacklist,
    nodeListFilter,
    typeMap,
    ingestibles: { nodeListRootFields },
  } = remoteSchema

  const rootFields = typeMap.get(`RootQuery`).fields

  // @todo This is temporary. We need a list of post types so we
  // can add field arguments just to post type fields so we can
  // get a flat list of posts and pages, instead of having them
  // nested as children
  // for example we need to do posts(where: { parent: null }) { nodes { ... }}
  // https://github.com/wp-graphql/wp-graphql/issues/928
  const {
    data: { postTypes },
  } = await fetchGraphql({ query: availablePostTypesQuery })

  let nodeQueries = {}

  for (const { type, name } of nodeListRootFields) {
    if (fieldBlacklist.includes(name)) {
      continue
    }

    // nested fields
    const fieldFields = typeMap.get(type.name).fields

    // a nested field containing a list of nodes
    const nodesField = fieldFields.find(nodeListFilter)

    // the type of this query
    const nodesType = typeMap.get(nodesField.type.ofType.name)

    const { fields } = nodesType

    const settings = getTypeSettingsByType(nodesType)

    if (settings.exclude) {
      continue
    }

    let nodeListQueries = []

    const singleTypeInfo = rootFields.find(
      field => field.type.name === nodesType.name
    )

    const singleFieldName = singleTypeInfo.name

    const transformedFields = recursivelyTransformFields({
      fields,
      parentType: type,
    })

    const recursivelyAliasFragments = field =>
      field.fragments.map(fragment => {
        // for each of this fragments fields
        fragment.fields = fragment.fields.map(fragmentField => {
          if (typeof fragmentField === `string`) {
            return fragmentField
          }

          // compare it against each field of each other fragment
          let updatedFragmentField = fragmentField

          field.fragments.forEach(possiblyConflictingFragment => {
            // don't compare this fragment against itself
            if (possiblyConflictingFragment.name === fragment.name) {
              return
            }

            possiblyConflictingFragment.fields.forEach(
              possiblyConflictingField => {
                const fieldNamesMatch =
                  fragmentField.fieldName === possiblyConflictingField.fieldName

                const fieldTypeKindsDontMatch =
                  possiblyConflictingField?.fieldType?.kind !==
                  fragmentField?.fieldType?.kind

                const fieldTypeNamesDontMatch =
                  possiblyConflictingField?.fieldType?.name !==
                  fragmentField?.fieldType?.name

                // if the fields have the same name but a different type kind
                // alias them
                if (
                  fieldNamesMatch &&
                  (fieldTypeKindsDontMatch || fieldTypeNamesDontMatch)
                ) {
                  const autoAliasedFieldName = `${fragmentField.fieldName}__typename_${fragmentField.fieldType.name}: ${fragmentField.fieldName}`

                  updatedFragmentField = {
                    ...fragmentField,
                    fieldName: autoAliasedFieldName,
                  }

                  return
                }
              }
            )
          })
          // if the fields have the same name but a different type AND the field has sub fields, compare those sub fields against any fragment fields subfields where the field name matches
          // if any subfields have conflicting types, alias them

          if (updatedFragmentField.fragments) {
            updatedFragmentField.fragments = recursivelyAliasFragments(
              updatedFragmentField
            )
          }

          return updatedFragmentField
        })

        return fragment
      })

    const aliasConflictingFields = async ({ transformedFields }) => {
      transformedFields = transformedFields.map(field => {
        // we only have conflicting fields in fragments
        // if there are no fragments, do nothing
        if (!field.fragments) {
          return field
        }

        field.fragments = recursivelyAliasFragments(field)

        return field
      })

      return transformedFields
    }

    const aliasedTransformedFields = await aliasConflictingFields({
      transformedFields,
      parentType: type,
    })

    const selectionSet = buildSelectionSet(aliasedTransformedFields)

    const nodeQuery = buildNodeQueryOnFieldName({
      fields: transformedFields,
      fieldName: singleFieldName,
      settings,
    })

    const previewQuery = buildNodeQueryOnFieldName({
      fields: transformedFields,
      fieldName: singleFieldName,
      fieldInputArguments: `id: $id, idType: DATABASE_ID`,
      queryName: `PREVIEW_QUERY`,
      settings,
    })

    if (
      settings.nodeListQueries &&
      typeof settings.nodeListQueries === `function`
    ) {
      const queries = settings.nodeListQueries({
        name,
        fields,
        postTypes,
        selectionSet,
        singleFieldName,
        singleTypeInfo,
        settings,
        store,
        remoteSchema,
        transformedFields,
        helpers: {
          recursivelyTransformFields,
          buildNodesQueryOnFieldName,
        },
      })

      if (queries && queries.length) {
        nodeListQueries = queries
      }
    }

    if (!nodeListQueries || !nodeListQueries.length) {
      const nodeListQuery = buildNodesQueryOnFieldName({
        fields: transformedFields,
        fieldName: name,
        postTypes,
        settings,
      })

      nodeListQueries = [nodeListQuery]
    }

    // build a query info object containing gql query strings for fetching
    // node lists or single nodes, as well as type info and plugin
    // settings for this type
    nodeQueries[name] = {
      typeInfo: {
        singularName: singleFieldName,
        pluralName: name,
        nodesTypeName: nodesType.name,
      },
      nodeListQueries,
      nodeQuery,
      previewQuery,
      selectionSet,
      settings,
    }
  }

  return nodeQueries
}

export default generateNodeQueriesFromIngestibleFields
