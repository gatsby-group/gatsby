import * as fs from "fs-extra"
import * as t from "@babel/types"
import traverse from "@babel/traverse"
import { codeFrameColumns, SourceLocation } from "@babel/code-frame"
import report from "gatsby-cli/lib/reporter"
import { babelParseToAst } from "../utils/babel-parse-to-ast"
import { testImportError } from "../utils/test-import-error"
import { resolveModule, ModuleResolver } from "../utils/module-resolver"
import { maybeAddFileProtocol, resolveJSFilepath } from "./resolve-js-file-path"
import { preferDefault } from "./prefer-default"
import { match } from "@reach/router"

const staticallyAnalyzeExports = (
  modulePath: string,
  resolver = resolveModule
): Array<string> => {
  let absPath: string | undefined
  const exportNames: Array<string> = []

  try {
    absPath = resolver(modulePath) as string
  } catch (err) {
    return exportNames // doesn't exist
  }
  const code = fs.readFileSync(absPath, `utf8`) // get file contents

  let ast: t.File
  try {
    ast = babelParseToAst(code, absPath)
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Pretty print syntax errors
      const codeFrame = codeFrameColumns(
        code,
        {
          start: (err as unknown as { loc: SourceLocation["start"] }).loc,
        },
        {
          highlightCode: true,
        }
      )

      report.panic(
        `Syntax error in "${absPath}":\n${err.message}\n${codeFrame}`
      )
    } else {
      // if it's not syntax error, just throw it
      throw err
    }
  }

  let isCommonJS = false
  let isES6 = false

  // extract names of exports from file
  traverse(ast, {
    // Check if the file is using ES6 imports
    ImportDeclaration: function ImportDeclaration() {
      isES6 = true
    },

    ExportNamedDeclaration: function ExportNamedDeclaration(astPath: t.NodePath<t.ExportNamedDeclaration>) {
      const declaration = astPath.node.declaration

      // get foo from `export const foo = bar`
      if (
        declaration?.type === `VariableDeclaration` &&
        declaration.declarations[0]?.id.type === `Identifier`
      ) {
        isES6 = true
        exportNames.push(declaration.declarations[0].id.name)
      }

      // get foo from `export function foo()`
      if (
        declaration?.type === `FunctionDeclaration` &&
        declaration.id?.type === `Identifier`
      ) {
        isES6 = true
        exportNames.push(declaration.id.name)
      }
    },

    // get foo from `export { foo } from 'bar'`
    // get foo from `export { foo }`
    ExportSpecifier: function ExportSpecifier(astPath: t.NodePath<t.ExportSpecifier>) {
      isES6 = true
      const exp = astPath?.node?.exported
      if (!exp) {
        return
      }
      if (exp.type === `Identifier`) {
        const exportName = exp.name
        if (exportName) {
          exportNames.push(exportName)
        }
      }
    },

    // export default () => {}
    // export default function() {}
    // export default function foo() {}
    // const foo = () => {}; export default foo
    ExportDefaultDeclaration: function ExportDefaultDeclaration(astPath: t.NodePath<t.ExportDefaultDeclaration>) {
      const declaration = astPath.node.declaration
      if (
        !t.isIdentifier(declaration) &&
        !t.isArrowFunctionExpression(declaration) &&
        !t.isFunctionDeclaration(declaration)
      ) {
        return
      }

      let name = ``
      if (t.isIdentifier(declaration)) {
        name = declaration.name
      } else if (t.isFunctionDeclaration(declaration) && declaration.id) {
        name = declaration.id.name
      }

      const exportName = `export default${name ? ` ${name}` : ``}`
      isES6 = true
      exportNames.push(exportName)
    },

    AssignmentExpression: function AssignmentExpression(astPath: t.NodePath<t.AssignmentExpression>) {
      const nodeLeft = astPath.node.left

      if (!t.isMemberExpression(nodeLeft)) {
        return
      }

      // ignore marker property `__esModule`
      if (
        t.isIdentifier(nodeLeft.property) &&
        nodeLeft.property.name === `__esModule`
      ) {
        return
      }

      // get foo from `exports.foo = bar`
      if (
        t.isIdentifier(nodeLeft.object) &&
        nodeLeft.object.name === `exports`
      ) {
        isCommonJS = true
        exportNames.push((nodeLeft.property as t.Identifier).name)
      }

      // get foo from `module.exports.foo = bar`
      if (t.isMemberExpression(nodeLeft.object)) {
        const exp: t.MemberExpression = nodeLeft.object

        if (
          t.isIdentifier(exp.object) &&
          t.isIdentifier(exp.property) &&
          exp.object.name === `module` &&
          exp.property.name === `exports`
        ) {
          isCommonJS = true
          exportNames.push((nodeLeft.property as t.Identifier).name)
        }
      }
    },
  })

  if (isES6 && isCommonJS && process.env.NODE_ENV !== `test`) {
    report.panic(
      `This plugin file is using both CommonJS and ES6 module systems together which we don't support.
You'll need to edit the file to use just one or the other.

plugin: ${modulePath}.js

This didn't cause a problem in Gatsby v1 so you might want to review the migration doc for this:
https://gatsby.dev/no-mixed-modules
      `
    )
  }
  return exportNames
}

interface IResolveModuleExportsOptions {
  mode?: `analysis` | `import`
  resolver?: ModuleResolver
  rootDir?: string
}

/**
 * Given a path to a module, return an array of the module's exports.
 *
 * It can run in two modes:
 * 1. `analysis` mode gets exports via static analysis by traversing the file's AST with babel
 * 2. `import` mode gets exports by directly importing the module and accessing its properties
 *
 * At the time of writing, analysis mode is used for files that can be jsx (e.g. gatsby-browser, gatsby-ssr)
 * and import mode is used for files that can be js or mjs.
 *
 * Returns [] for invalid paths and modules without exports.
 */
export async function resolveModuleExports(
  modulePath: string,
  {
    mode = `analysis`,
    resolver = resolveModule,
    rootDir = process.cwd(),
  }: IResolveModuleExportsOptions = {}
): Promise<Array<string>> {
  if (mode === `import`) {
    try {
      const moduleFilePath = await resolveJSFilepath({
        rootDir,
        filePath: modulePath,
      })

      if (!moduleFilePath) {
        return []
      }

      const rawImportedModule = await import(
        maybeAddFileProtocol(moduleFilePath)
      )

      // If the module is cjs, the properties we care about are nested under a top-level `default` property
      const importedModule = preferDefault(rawImportedModule)

      return Object.keys(importedModule).filter(
        exportName => exportName !== `__esModule`
      )
    } catch (error) {
      if (!testImportError(modulePath, error)) {
        // if module exists, but requiring it cause errors,
        // show the error to the user and terminate build
        report.panic(`Error in "${modulePath}":`, error)
      }
    }
  } else {
    return staticallyAnalyzeExports(modulePath, resolver)
  }

  return []
}
import { match } from "@reach/router"

export function matchPath(rawPath: string, matchPath?: string): PathMatch {
  // Normalize paths
  const path = rawPath || `/`

  // First try original path
  let result = reachMatch(matchPath || path, { path })

  // If no match and path has encoded characters
  if (!result && path.includes('%')) {
    try {
      // Try matching decoded path
      const decodedPath = decodeURIComponent(path)
      result = reachMatch(matchPath || decodedPath, { path: decodedPath })

      // Handle double-encoded paths
      if (!result && decodedPath.includes('%')) {
        const doubleDecodedPath = decodeURIComponent(decodedPath)
        result = reachMatch(matchPath || doubleDecodedPath, {
          path: doubleDecodedPath
        })
      }
    } catch (e) {
      // Silently handle decode errors
    }
  }

  // Always return valid params object
  return {
    params: result?.params || {},
    uri: result?.uri || path,
    path: result?.path || path
  }
}
