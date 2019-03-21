const Redux = require(`redux`)
const _ = require(`lodash`)
const fs = require(`fs-extra`)
const mitt = require(`mitt`)
const stringify = require(`json-stringify-safe`)
const thunk = require(`redux-thunk`).default

// Create event emitter for actions
const emitter = mitt()

// Reducers
const reducers = require(`./reducers`)

const objectToMap = obj => {
  let map = new Map()
  Object.keys(obj).forEach(key => {
    map.set(key, obj[key])
  })
  return map
}

const mapToObject = map => {
  const obj = {}
  for (let [key, value] of map) {
    obj[key] = value
  }
  return obj
}

// Read from cache the old node data.
let initialState = {}
try {
  const file = fs.readFileSync(`${process.cwd()}/.cache/redux-state.json`)
  // Apparently the file mocking in node-tracking-test.js
  // can override the file reading replacing the mocked string with
  // an already parsed object.
  if (Buffer.isBuffer(file) || typeof file === `string`) {
    initialState = JSON.parse(file)
  }
  if (initialState.staticQueryComponents) {
    initialState.staticQueryComponents = objectToMap(
      initialState.staticQueryComponents
    )
  }
  if (initialState.components) {
    initialState.components = objectToMap(initialState.components)
  }
  if (initialState.nodes) {
    initialState.nodes = objectToMap(initialState.nodes)

    initialState.nodesByType = new Map()
    initialState.nodes.forEach(node => {
      const { type } = node.internal
      if (!initialState.nodesByType.has(type)) {
        initialState.nodesByType.set(type, new Map())
      }
      initialState.nodesByType.get(type).set(node.id, node)
    })
  }
} catch (e) {
  // ignore errors.
}

const multi = ({ dispatch }) => next => action =>
  Array.isArray(action) ? action.filter(Boolean).map(dispatch) : next(action)

const configureStore = initialState =>
  Redux.createStore(
    Redux.combineReducers({ ...reducers }),
    initialState,
    Redux.applyMiddleware(thunk, multi)
  )

const store = configureStore(initialState)

// Persist state.
function saveState() {
  const state = store.getState()
  const pickedState = _.pick(state, [
    `nodes`,
    `status`,
    `componentDataDependencies`,
    `jsonDataPaths`,
    `components`,
    `staticQueryComponents`,
  ])

  pickedState.staticQueryComponents = mapToObject(
    pickedState.staticQueryComponents
  )
  pickedState.components = mapToObject(pickedState.components)
  pickedState.nodes = pickedState.nodes ? mapToObject(pickedState.nodes) : []
  const stringified = stringify(pickedState, null, 2)
  return fs.writeFile(`${process.cwd()}/.cache/redux-state.json`, stringified)
}

store.subscribe(() => {
  const lastAction = store.getState().lastAction
  emitter.emit(lastAction.type, lastAction)
})

module.exports = {
  /** Event emitter */
  emitter,
  /** Redux store */
  store,
  configureStore,
  saveState,
}
