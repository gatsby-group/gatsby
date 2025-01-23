const { parse: json2csv } = require(`json2csv`)
const os = require(`os`)
const { onCreateNode } = require(`../gatsby-node`)
const { typeNameFromDir, typeNameFromFile } = require(`../index`)

// Make some fake functions its expecting.
const loadNodeContent = node => Promise.resolve(node.content)

const bootstrapTest = async (node, pluginOptions = {}) => {
  const createNode = jest.fn()
  const createParentChildLink = jest.fn()
  const actions = { createNode, createParentChildLink }
  const createNodeId = jest.fn()
  createNodeId.mockReturnValue(`uuid-from-gatsby`)
  const createContentDigest = jest.fn().mockReturnValue(`contentDigest`)

  return await onCreateNode(
    {
      node,
      loadNodeContent,
      actions,
      createNodeId,
      createContentDigest,
    },
    pluginOptions
  ).then(() => {
    return {
      createNode,
      createParentChildLink,
    }
  })
}

describe(`Process nodes correctly`, () => {
  const baseNode = {
    name: `test`,
    id: `whatever`,
    parent: null,
    children: [],
    extension: `csv`,
    internal: {
      contentDigest: `whatever`,
      mediaType: `text/csv`,
    },
  }

  it(`correctly creates nodes from JSON which is an array of objects`, async () => {
    const fields = [`blue`, `funny`]
    const data = [
      { blue: true, funny: `yup` },
      { blue: false, funny: `nope` },
    ]
    const csv = json2csv(data, { fields })
    const node = {
      ...baseNode,
      content: csv,
    }

    return bootstrapTest(node).then(({ createNode, createParentChildLink }) => {
      expect(createNode.mock.calls).toMatchSnapshot()
      expect(createParentChildLink.mock.calls).toMatchSnapshot()
      expect(createNode).toHaveBeenCalledTimes(2)
      expect(createParentChildLink).toHaveBeenCalledTimes(2)
    })
  })

  it(`correctly handles the noheader option`, async () => {
    const node = {
      ...baseNode,
      content: `blue,funny\ntrue,yup\nfalse,nope`,
    }

    return bootstrapTest(node, { noheader: true }).then(
      ({ createNode, createParentChildLink }) => {
        expect(createNode.mock.calls).toMatchSnapshot()
        expect(createParentChildLink.mock.calls).toMatchSnapshot()
        expect(createNode).toHaveBeenCalledTimes(3)
        expect(createParentChildLink).toHaveBeenCalledTimes(3)
      }
    )
  })

  it(`allows other extensions to be used for input files`, async () => {
    const node = {
      ...baseNode,
      content: `blue\tfunny\ntrue\tyup\nfalse\tnope`,
      extension: `ksv`,
      internal: {
        ...baseNode.internal,
        mediaType: `text/ksv`,
      },
    }

    return bootstrapTest(node, {
      noheader: true,
      extensions: [`ksv`],
      delimiter: `\t`,
    }).then(({ createNode, createParentChildLink }) => {
      expect(createNode.mock.calls).toMatchSnapshot()
      expect(createParentChildLink.mock.calls).toMatchSnapshot()
      expect(createNode).toHaveBeenCalledTimes(3)
      expect(createParentChildLink).toHaveBeenCalledTimes(3)
    })
  })

  it(`passes through the delimiter option`, async () => {
    const node = {
      ...baseNode,
      extension: `tsv`,
      content: `blue\tfunny\ntrue\tyup\nfalse\tnope`,
      internal: {
        ...baseNode.internal,
        mediaType: `text/tsv`,
      },
    }

    return bootstrapTest(node, {
      noheader: true,
      extensions: [`tsv`],
      delimiter: `\t`,
    }).then(({ createNode, createParentChildLink }) => {
      expect(createNode.mock.calls).toMatchSnapshot()
      expect(createParentChildLink.mock.calls).toMatchSnapshot()
      expect(createNode).toHaveBeenCalledTimes(3)
      expect(createParentChildLink).toHaveBeenCalledTimes(3)
    })
  })

  it(`correctly handles the typeName option with the provided typeNameFromFile function`, async () => {
    const node = {
      ...baseNode,
      name: `theQueryShouldMatch`,
      content: `letter,number\na,65\nb,42\nc,23`,
    }

    return bootstrapTest(node, { typeName: typeNameFromFile }).then(
      ({ createNode, createParentChildLink }) => {
        expect(createNode.mock.calls).toMatchSnapshot()
        expect(createParentChildLink.mock.calls).toMatchSnapshot()
        expect(createNode).toHaveBeenCalledTimes(3)
        expect(createParentChildLink).toHaveBeenCalledTimes(3)
      }
    )
  })

  it(`correctly handles the typeName option with the provided typeNameFromDir function`, async () => {
    const node = {
      ...baseNode,
      name: `theTypeWontBeThis`,
      content: `letter,number\na,65\nb,42\nc,23`,
      dir: `${os.tmpdir()}/foo/`, // The type will be FooCsv
      internal: {
        ...baseNode.internal,
        type: `File`,
      },
    }

    return bootstrapTest(node, { typeName: typeNameFromDir }).then(
      ({ createNode, createParentChildLink }) => {
        expect(createNode.mock.calls).toMatchSnapshot()
        expect(createParentChildLink.mock.calls).toMatchSnapshot()
        expect(createNode).toHaveBeenCalledTimes(3)
        expect(createParentChildLink).toHaveBeenCalledTimes(3)
      }
    )
  })

  it(`correctly handles the typeName option with a custom function`, async () => {
    const node = {
      ...baseNode,
      name: `theTypeWontBeThis`,
      content: `letter,number\na,65\nb,42\nc,23`,
    }

    return bootstrapTest(node, {
      typeName: () => `CsvTypeSetByFunction`,
    }).then(({ createNode, createParentChildLink }) => {
      expect(createNode.mock.calls).toMatchSnapshot()
      expect(createParentChildLink.mock.calls).toMatchSnapshot()
      expect(createNode).toHaveBeenCalledTimes(3)
      expect(createParentChildLink).toHaveBeenCalledTimes(3)
    })
  })

  it(`correctly handles the typeName option with a string`, async () => {
    const node = {
      ...baseNode,
      name: `theTypeWontBeThis`,
      content: `letter,number\na,65\nb,42\nc,23`,
    }

    return bootstrapTest(node, {
      typeName: `CsvTypeSetByFunction`,
    }).then(({ createNode, createParentChildLink }) => {
      expect(createNode.mock.calls).toMatchSnapshot()
      expect(createParentChildLink.mock.calls).toMatchSnapshot()
      expect(createNode).toHaveBeenCalledTimes(3)
      expect(createParentChildLink).toHaveBeenCalledTimes(3)
    })
  })

  it(`correctly handles the nodePerFile option in the false case`, async () => {
    const node = {
      ...baseNode,
      name: `theTypeWillBeThis`,
      content: `letter,number\na,65\nb,42\nc,23`,
    }

    return bootstrapTest(node, {
      nodePerFile: false,
    }).then(({ createNode, createParentChildLink }) => {
      expect(createNode.mock.calls).toMatchSnapshot()
      expect(createParentChildLink.mock.calls).toMatchSnapshot()
      expect(createNode).toHaveBeenCalledTimes(3)
      expect(createParentChildLink).toHaveBeenCalledTimes(3)
    })
  })

  it(`correctly handles the nodePerFile option in the true case`, async () => {
    const node = {
      ...baseNode,
      name: `theTypeWillBeThis`,
      content: `letter,number\na,65\nb,42\nc,23`,
    }

    return bootstrapTest(node, {
      nodePerFile: true,
    }).then(({ createNode, createParentChildLink }) => {
      expect(createNode.mock.calls).toMatchSnapshot()
      expect(createParentChildLink.mock.calls).toMatchSnapshot()
      expect(createNode).toHaveBeenCalledTimes(1)
      expect(createParentChildLink).toHaveBeenCalledTimes(1)
    })
  })

  it(`correctly handles the nodePerFile option in the string case`, async () => {
    const node = {
      ...baseNode,
      name: `theTypeWillBeThis`,
      content: `letter,number\na,65\nb,42\nc,23`,
    }

    return bootstrapTest(node, {
      nodePerFile: `theItems`,
    }).then(({ createNode, createParentChildLink }) => {
      expect(createNode.mock.calls).toMatchSnapshot()
      expect(createParentChildLink.mock.calls).toMatchSnapshot()
      expect(createNode).toHaveBeenCalledTimes(1)
      expect(createParentChildLink).toHaveBeenCalledTimes(1)
    })
  })
})
