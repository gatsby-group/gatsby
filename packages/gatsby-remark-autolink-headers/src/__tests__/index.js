const Remark = require(`remark`)
const toString = require(`mdast-util-to-string`)
const visit = require(`unist-util-visit`)

const plugin = require(`../`)

const remark = new Remark().data(`settings`, {
  commonmark: true,
  footnotes: true,
  pedantic: true,
})

describe(`gatsby-remark-autolink-headers`, () => {
  it(`adds id to a markdown header`, () => {
    const markdownAST = remark.parse(`# Heading Uno`)

    const transformed = plugin({ markdownAST }, {})

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()

      expect(node).toMatchSnapshot()
    })
  })

  it(`adds ids to each markdown header`, () => {
    const markdownAST = remark.parse(`
# Heading One

## Heading Two

### Heading Three
    `)

    const transformed = plugin({ markdownAST }, {})

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()
    })
  })

  it(`adds id to a markdown header with custom svg icon`, () => {
    const markdownAST = remark.parse(`# Heading Uno`)
    const icon = `<svg width="400" height="110"><rect width="300" height="100" /></svg>`

    const transformed = plugin({ markdownAST }, { icon })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()

      expect(node).toMatchSnapshot()
    })
  })

  it(`adds ids to each markdown header with custom svg icon`, () => {
    const markdownAST = remark.parse(`
# Heading One

## Heading Two

### Heading Three
    `)
    const icon = `<svg width="400" height="110"><rect width="300" height="100" /></svg>`

    const transformed = plugin({ markdownAST }, { icon })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()
    })
  })

  it(`adds id to a markdown header with custom class`, () => {
    const markdownAST = remark.parse(`# Heading Uno`)
    const className = `custom-class`

    const transformed = plugin({ markdownAST }, { className })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()

      expect(node).toMatchSnapshot()
    })
  })

  it(`adds ids to each markdown header with custom class`, () => {
    const markdownAST = remark.parse(`
# Heading One

## Heading Two

### Heading Three
    `)
    const className = `custom-class`

    const transformed = plugin({ markdownAST }, { className })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()
    })
  })

  it(`adds id to a markdown header with no icon`, () => {
    const markdownAST = remark.parse(`# Heading Uno`)
    const icon = false

    const transformed = plugin({ markdownAST }, { icon })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()

      expect(node).toMatchSnapshot()
    })
  })

  it(`adds ids to each markdown header with no icon`, () => {
    const markdownAST = remark.parse(`
# Heading One

## Heading Two

### Heading Three
    `)
    const icon = false

    const transformed = plugin({ markdownAST }, { icon })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()
    })
  })

  it(`maintain case of markdown header for id`, () => {
    const markdownAST = remark.parse(`
# Heading One

## Heading Two

### Heading Three
    `)
    const maintainCase = true

    const transformed = plugin({ markdownAST }, { maintainCase })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()

      expect(node).toMatchSnapshot()
    })
  })

  it(`keeps accents by default`, () => {
    const markdownAST = remark.parse(`
# Héading One

## Héading Two

### Héading Three
    `)
    const removeAccents = false

    const transformed = plugin({ markdownAST }, { removeAccents })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()
      expect(node.data.id).toEqual(expect.stringMatching(/^héading/))
    })
  })

  it(`remove accents if removeAccents is passed`, () => {
    const markdownAST = remark.parse(`
# Héading One

## Héading Two

### Héading Three
    `)
    const removeAccents = true

    const transformed = plugin({ markdownAST }, { removeAccents })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()
      expect(node.data.id).toEqual(expect.stringMatching(/^heading/))
    })
  })

  it(`extracts custom id`, () => {
    const markdownAST = remark.parse(`
# Heading One {#custom_h1}

## Heading Two {#custom-heading-two}

# With *Bold* {#custom-withbold}

# Not italic {#not_italic_here}

# No custom ID

# {#id-only}

# {#text-after} custom ID
    `)
    const enableCustomId = true

    const transformed = plugin({ markdownAST }, { enableCustomId })

    const headers = []
    visit(transformed, `heading`, node => {
      headers.push({ text: toString(node), id: node.data.id })
    })
    expect(headers).toEqual([
      {
        id: `custom_h1`,
        text: `Heading One`,
      },
      {
        id: `custom-heading-two`,
        text: `Heading Two`,
      },
      {
        id: `custom-withbold`,
        text: `With Bold`,
      },
      {
        id: `not_italic_here`,
        text: `Not italic`,
      },
      {
        id: `no-custom-id`,
        text: `No custom ID`,
      },
      {
        id: `id-only`,
        text: `{#id-only}`,
      },
      {
        id: `text-after-custom-id`,
        text: `{#text-after} custom ID`,
      },
    ])
  })

  it(`adds places anchor after header when isIconAfterHeader prop is passed`, () => {
    const markdownAST = remark.parse(`# Heading Uno`)

    const isIconAfterHeader = true
    const transformed = plugin({ markdownAST }, { isIconAfterHeader })

    visit(transformed, `heading`, node => {
      expect(node.data.hProperties.style).toInclude(`position:relative`)
      expect(node.children).toHaveLength(2)
      expect(node.children[1].data.hProperties.class).toContain(`after`)

      expect(node).toMatchSnapshot()
    })
  })

  it(`adds scroll-margin-top when offsetY prop is passed`, () => {
    const markdownAST = remark.parse(`# Heading Uno`)

    const offsetY = 32
    const transformed = plugin({ markdownAST }, { offsetY })

    visit(transformed, `heading`, node => {
      expect(node.data.hProperties.style).toInclude(
        `scroll-margin-top:${offsetY}px`
      )

      expect(node).toMatchSnapshot()
    })
  })

  it(`adds anchor after header and scroll-margin-top when isIconAfterHeader and offsetY props are passed`, () => {
    const markdownAST = remark.parse(`# Heading Uno`)

    const isIconAfterHeader = true
    const offsetY = 32
    const transformed = plugin({ markdownAST }, { isIconAfterHeader, offsetY })

    visit(transformed, `heading`, node => {
      expect(node.data.hProperties.style).toInclude(`position:relative`)
      expect(node.children).toHaveLength(2)
      expect(node.children[1].data.hProperties.class).toContain(`after`)

      expect(node.data.hProperties.style).toInclude(
        `scroll-margin-top:${offsetY}px`
      )

      expect(node).toMatchSnapshot()
    })
  })

  it(`adds id to a markdown heading when elements prop is passed with matching heading type`, () => {
    const markdownAST = remark.parse(`# Heading Uno`)

    const transformed = plugin({ markdownAST }, { elements: [`h1`] })

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()

      expect(node).toMatchSnapshot()
    })
  })

  it(`does not add data to a markdown heading when elements prop is passed with no matching heading type`, () => {
    const markdownAST = remark.parse(`# Heading Uno`)

    const transformed = plugin({ markdownAST }, { elements: [`h2`] })

    visit(transformed, `heading`, node => {
      expect(node.data).not.toBeDefined()

      expect(node).toMatchSnapshot()
    })
  })

  it(`does not add data to a markdown heading with custom id when elements prop is passed with no matching heading type`, () => {
    const markdownAST = remark.parse(`# Heading Uno {#custom_h1}`)

    const transformed = plugin({ markdownAST }, { elements: [`h2`] })

    visit(transformed, `heading`, node => {
      expect(node.data).not.toBeDefined()

      expect(node).toMatchSnapshot()
    })
  })

  it(`only adds ids to markdown headings whose heading type is included in the passed elements prop`, () => {
    const markdownAST = remark.parse(`
    # Heading One

    ## Heading Two

    ### Heading Three
        `)

    const transformed = plugin({ markdownAST }, { elements: [`h2`] })

    visit(transformed, `heading`, node => {
      if (node.depth === 2) {
        expect(node.data.id).toBeDefined()
      } else {
        expect(node.data).not.toBeDefined()
      }
    })
  })

  it(`does not add data to markdown headings when an empty array elements prop is passed`, () => {
    const markdownAST = remark.parse(`
    # Heading One

    ## Heading Two

    ### Heading Three
        `)

    const transformed = plugin({ markdownAST }, { elements: [] })

    visit(transformed, `heading`, node => {
      expect(node.data).not.toBeDefined()
    })
  })

  it(`allows all six heading depths to be passed in the elements prop`, () => {
    const markdownAST = remark.parse(`
    # Heading One

    ## Heading Two

    ### Heading Three

    #### Heading Four

    ##### Heading Five

    ###### Heading Six
        `)

    const transformed = plugin(
      { markdownAST },
      { elements: [`h1`, `h2`, `h3`, `h4`, `h5`, `h6`] }
    )

    visit(transformed, `heading`, node => {
      expect(node.data.id).toBeDefined()
    })
  })
})
