import { resolve } from "path"

import { promises } from "fs"
import { sqip } from "sqip"

import { generateSqip } from "../generate-sqip"

jest.mock(`sqip`, () => {
  const originalModule = jest.requireActual(`sqip`)
  return {
    ...originalModule,
    sqip: jest.fn(() => {
      return {
        content: Buffer.from(`<svg><!-- Mocked SQIP SVG --></svg>`),
        metadata: {
          palette: {
            Vibrant: {
              rgb: [1, 2, 3],
              hsl: [0.1, 0.2, 0.3],
              hex: `#M0CK3D`,
              population: 42,
            },
          },
          dataURI: `data:mocked`,
        },
      }
    }),
  }
})

jest.mock(`fs`, () => {
  const originalModule = jest.requireActual(`fs`)
  return {
    ...originalModule,
    promises: {
      ...originalModule.promises,
      // access: access,
      access: jest.fn(() => {
        throw new Error(`file does not exist`)
      }),
      readFile: jest.fn(() =>
        Buffer.from(`<svg><!-- Cached SQIP SVG --></svg>`)
      ),
      writeFile: jest.fn(),
    },
  }
})

afterEach(() => {
  sqip.mockClear()
  promises.access.mockClear()
  promises.readFile.mockClear()
  promises.writeFile.mockClear()
})

describe(`gatsby-transformer-sqip`, () => {
  const absolutePath = resolve(
    __dirname,
    `images`,
    `this-file-does-not-need-to-exist-for-the-test.jpg`
  )
  const cacheDir = __dirname

  describe(`generateSqip`, () => {
    it(`not cached`, async () => {
      const cache = {
        get: jest.fn(),
        set: jest.fn(),
      }
      const numberOfPrimitives = 5
      const blur = 0
      const mode = 3
      const result = await generateSqip({
        cache,
        cacheDir,
        absolutePath,
        numberOfPrimitives,
        blur,
        mode,
      })
      expect(result).toMatchSnapshot()
      expect(sqip).toHaveBeenCalledTimes(1)
      const sqipArgs = sqip.mock.calls[0][0]
      expect(sqipArgs.input).toMatch(absolutePath)
      delete sqipArgs.input
      expect(sqipArgs).toMatchSnapshot()

      expect(promises.access).toHaveBeenCalledTimes(1)
      expect(promises.writeFile).toHaveBeenCalledTimes(2)
      expect(promises.readFile).toHaveBeenCalledTimes(0)
    })
    it(`cached`, async () => {
      promises.access.mockImplementation(() => true)
      promises.readFile.mockImplementationOnce(() =>
        Buffer.from(`<svg><!-- Cached SQIP SVG --></svg>`)
      )
      promises.readFile.mockImplementationOnce(() =>
        Buffer.from(`{"mocked": "json", "palette": {}}`)
      )
      const cache = {
        get: jest.fn(),
        set: jest.fn(),
      }
      const numberOfPrimitives = 5
      const blur = 0
      const mode = 3
      const result = await generateSqip({
        cache,
        cacheDir,
        absolutePath,
        numberOfPrimitives,
        blur,
        mode,
      })

      expect(result).toMatchSnapshot()

      expect(promises.access).toHaveBeenCalledTimes(2)
      expect(promises.writeFile).toHaveBeenCalledTimes(0)
      expect(promises.readFile).toHaveBeenCalledTimes(2)
      expect(sqip).toHaveBeenCalledTimes(0)
    })
    it(`returns null for unsupported files`, async () => {
      promises.access.mockImplementationOnce(() => true)

      const cache = {
        get: jest.fn(),
        set: jest.fn(),
      }
      const numberOfPrimitives = 5
      const blur = 0
      const mode = 3
      const result = await generateSqip({
        cache,
        cacheDir,
        absolutePath: absolutePath.replace(`.jpg`, `.svg`),
        numberOfPrimitives,
        blur,
        mode,
      })

      expect(result).toBe(null)

      expect(sqip).toHaveBeenCalledTimes(0)
      expect(promises.access).toHaveBeenCalledTimes(0)
      expect(promises.writeFile).toHaveBeenCalledTimes(0)
      expect(promises.readFile).toHaveBeenCalledTimes(0)
    })
  })
})
