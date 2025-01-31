import sortBy from "lodash/sortBy"
import report from "gatsby-cli/lib/reporter"
import typeOf from "type-of"
import util from "util"

import { Node } from "../../../index"

export interface ITypeConflictExample {
  value: unknown
  type: string
  parent?: Node
  arrayTypes?: Array<string>
}

interface ITypeConflict {
  value: unknown
  description?: string
}

const formatValue = (value: unknown): string => {
  if (!Array.isArray(value)) {
    return util.inspect(value, {
      colors: true,
      depth: 0,
      breakLength: Infinity,
    })
  }

  const output: Array<string> = []

  if (value.length === 1) {
    // For arrays usually a single conflicting item is exposed vs. the whole array
    output.push(`...`)
    output.push(formatValue(value[0]))
    output.push(`...`)
  } else {
    let wasElipsisLast = false
    const usedTypes: Array<string> = []
    value.forEach(item => {
      const type = typeOf(item)
      if (usedTypes.includes(type)) {
        if (!wasElipsisLast) {
          output.push(`...`)
          wasElipsisLast = true
        }
      } else {
        output.push(formatValue(item))
        wasElipsisLast = false
        usedTypes.push(type)
      }
    })
  }

  return `[ ${output.join(`, `)} ]`
}

class TypeConflictEntry {
  selector: string
  types: Map<string, ITypeConflict>

  constructor(selector: string) {
    this.selector = selector
    this.types = new Map()
  }

  addExample({ value, type, parent }: ITypeConflictExample): void {
    this.types.set(type, {
      value,
      description: parent?.internal?.description ?? ``,
    })
  }

  printEntry(): void {
    const sortedByTypeName = sortBy(
      Array.from(this.types.entries()),
      ([typeName]) => typeName
    )

    report.log(
      `${this.selector}:${sortedByTypeName
        .map(
          ([typeName, { value, description }]) =>
            `\n - type: ${typeName}\n   value: ${formatValue(value)}${
              description && `\n   source: ${description}`
            }`
        )
        .join(``)}`
    )
  }
}

class TypeConflictReporter {
  entries: Map<string, TypeConflictEntry>

  constructor() {
    this.entries = new Map()
  }

  clearConflicts(): void {
    this.entries.clear()
  }

  getEntryFromSelector(selector: string): TypeConflictEntry {
    let dataEntry = this.entries.get(selector)

    if (!dataEntry) {
      dataEntry = new TypeConflictEntry(selector)
      this.entries.set(selector, dataEntry)
    }

    return dataEntry
  }

  addConflict(selector: string, examples: Array<ITypeConflictExample>): void {
    if (selector.substring(0, 11) === `SitePlugin.`) {
      // Don't store and print out type conflicts in plugins.
      // This is out of user control so he/she can't do anything
      // to hide those.
      return
    }

    const entry = this.getEntryFromSelector(selector)
    examples
      .filter(example => example.value != null)
      .forEach(example => entry.addExample(example))
  }

  printConflicts(): void {
    if (this.entries.size > 0) {
      report.warn(
        `There are conflicting field types in your data.\n\n` +
          `If you have explicitly defined a type for those fields, you can ` +
          `safely ignore this warning message.\n` +
          `Otherwise, Gatsby will omit those fields from the GraphQL schema.\n\n` +
          `If you know all field types in advance, the best strategy is to ` +
          `explicitly define them with the \`createTypes\` action, and skip ` +
          `inference with the \`@dontInfer\` directive.\n` +
          `See https://www.gatsbyjs.com/docs/reference/config-files/actions/#createTypes`
      )
      this.entries.forEach(entry => entry.printEntry())
    }
  }

  getConflicts(): Array<TypeConflictEntry> {
    return Array.from(this.entries.values())
  }
}

export { TypeConflictReporter, TypeConflictEntry }
