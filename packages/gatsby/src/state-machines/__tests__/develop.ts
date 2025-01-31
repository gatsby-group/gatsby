/* eslint-disable @typescript-eslint/no-explicit-any */
import { developMachine } from "../develop"
import { interpret } from "xstate"
import { IProgram } from "../../commands/types"

const actions = {
  assignStoreAndWorkerPool: jest.fn(),
  assignServiceResult: jest.fn(),
  callApi: jest.fn(),
  finishParentSpan: jest.fn(),
  saveDbState: jest.fn(),
  logError: jest.fn(),
  panic: jest.fn(),
  panicBecauseOfInfiniteLoop: jest.fn(),
}

const services = {
  initialize: jest.fn(),
  initializeData: jest.fn(),
  reloadData: jest.fn(),
  runQueries: jest.fn(),
  startWebpackServer: jest.fn(),
  recompile: jest.fn(),
  waitForMutations: jest.fn(),
  recreatePages: jest.fn(),
}

const throwService = async (): Promise<void> => {
  throw new Error(`fail`)
}

const rejectService = async (): Promise<void> => Promise.reject(`fail`)

const machine = developMachine.withConfig(
  {
    actions,
    services,
  },
  {
    program: {} as IProgram,
  }
)

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

const resetMocks = (mocks: Record<string, jest.Mock>): void =>
  Object.values(mocks).forEach(mock => mock.mockReset())

const resetAllMocks = (): void => {
  resetMocks(services)
  resetMocks(actions)
}

describe(`the top-level develop state machine`, () => {
  beforeEach(() => {
    resetAllMocks()
  })

  afterEach(async () => {
    await tick()
  })

  it(`initialises`, async () => {
    const service = interpret(machine)
    service.start()
    expect(service.state.value).toBe(`initializing`)
  })

  it(`runs node mutation during initialising data state`, () => {
    const payload = { foo: 1 }
    const service = interpret(machine)

    service.start()
    service.send(`done.invoke.initialize`)
    expect(service.state.value).toBe(`initializingData`)
    service.send(`ADD_NODE_MUTATION`, payload)
    expect(actions.callApi).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: `ADD_NODE_MUTATION`, ...payload }),
      expect.anything()
    )
  })

  it(`marks source file as dirty during node sourcing`, () => {
    const service = interpret(machine)

    service.start()
    expect(service.state.value).toBe(`initializing`)
    service.send(`done.invoke.initialize`)
    expect(service.state.value).toBe(`initializingData`)
    expect(service.state.context.sourceFilesDirty).toBeFalsy()
    service.send(`SOURCE_FILE_CHANGED`)
    expect(service.state.context.sourceFilesDirty).toBeTruthy()
  })

  // This is current behaviour, but it will be queued in future
  it(`handles a webhook during node sourcing`, () => {
    const webhookBody = { foo: 1 }
    const service = interpret(machine)
    service.start()
    expect(service.state.value).toBe(`initializing`)
    service.send(`done.invoke.initialize`)
    expect(service.state.value).toBe(`initializingData`)
    expect(service.state.context.webhookBody).toBeUndefined()
    service.send(`WEBHOOK_RECEIVED`, { payload: { webhookBody } })
    expect(service.state.context.webhookBody).toEqual(webhookBody)
    expect(services.reloadData).toHaveBeenCalled()
  })

  it(`runs a node mutation during query running and marks node as dirty`, () => {
    const payload = { foo: 1 }

    const service = interpret(machine)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    expect(service.state.context.nodeMutationBatch).toBeUndefined()
    expect(service.state.context.nodesMutatedDuringQueryRun).toBeFalsy()

    service.send(`ADD_NODE_MUTATION`, { payload })
    expect(service.state.context.nodesMutatedDuringQueryRun).toBeTruthy()
    expect(actions.callApi).toHaveBeenCalled()
  })

  it(`increments the recompile count if nodes were mutated during query running`, () => {
    const payload = { foo: 1 }

    const service = interpret(machine)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    service.send(`ADD_NODE_MUTATION`, { payload })
    service.send(`done.invoke.run-queries`)
    expect(
      service.state.context.nodesMutatedDuringQueryRunRecompileCount
    ).toEqual(1)
    expect(service.state.context.nodesMutatedDuringQueryRun).toBeFalsy()
  })

  it(`resets the recompile count if nodes were not mutated during query running`, () => {
    const service = interpret(machine)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    service.state.context.compiler = {} as any
    service.state.context.nodesMutatedDuringQueryRunRecompileCount = 1
    service.send(`done.invoke.run-queries`)
    expect(
      service.state.context.nodesMutatedDuringQueryRunRecompileCount
    ).toEqual(0)
    expect(service.state.context.nodesMutatedDuringQueryRun).toBeFalsy()
  })

  it(`panics if the recompile count is above the limit`, () => {
    const payload = { foo: 1 }

    const service = interpret(machine)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)

    service.send(`ADD_NODE_MUTATION`, { payload })
    service.send(`done.invoke.run-queries`)
    for (let index = 0; index < 6; index++) {
      service.send(`done.invoke.recreate-pages`)
      service.send(`ADD_NODE_MUTATION`, { payload })
      service.send(`done.invoke.run-queries`)
    }
    expect(actions.panicBecauseOfInfiniteLoop).toHaveBeenCalled()
  })

  it(`starts webpack if there is no compiler`, () => {
    const service = interpret(machine)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    expect(service.state.context.compiler).toBeUndefined()
    services.startWebpackServer.mockReset()
    service.send(`done.invoke.run-queries`)
    expect(services.startWebpackServer).toHaveBeenCalled()
  })

  it(`recompiles if source files have changed`, () => {
    const service = interpret(machine)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`SOURCE_FILE_CHANGED`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    // So we don't start webpack instead
    service.state.context.compiler = {} as any
    services.recompile.mockReset()
    service.send(`done.invoke.run-queries`)
    expect(services.startWebpackServer).not.toHaveBeenCalled()
    expect(services.recompile).toHaveBeenCalled()
  })

  it(`skips compilation if source files are unchanged`, () => {
    const service = interpret(machine)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    service.state.context.compiler = {} as any
    services.recompile.mockReset()
    service.send(`done.invoke.run-queries`)
    expect(services.startWebpackServer).not.toHaveBeenCalled()
    expect(services.recompile).not.toHaveBeenCalled()
  })

  it(`recreates pages when waiting is complete`, () => {
    const service = interpret(machine)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    service.state.context.compiler = {} as any
    service.send(`done.invoke.run-queries`)
    service.send(`done.invoke.waiting`)

    expect(services.recreatePages).toHaveBeenCalled()
  })

  it(`extracts queries when waiting requests it`, () => {
    const service = interpret(machine)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    service.state.context.compiler = {} as any
    service.send(`done.invoke.run-queries`)
    service.send(`EXTRACT_QUERIES_NOW`)
    expect(services.runQueries).toHaveBeenCalled()
  })

  it(`panics on error during initialisation`, async () => {
    const service = interpret(machine)
    services.initialize.mockImplementationOnce(throwService)
    service.start()
    await tick()
    expect(actions.panic).toHaveBeenCalled()
  })

  it(`panics on rejection during initialisation`, async () => {
    const service = interpret(machine)
    services.initialize.mockImplementationOnce(rejectService)
    service.start()
    await tick()
    expect(actions.panic).toHaveBeenCalled()
  })

  it(`logs errors during sourcing and transitions to waiting`, async () => {
    const service = interpret(machine)
    services.initializeData.mockImplementationOnce(throwService)
    service.start()
    service.send(`done.invoke.initialize`)
    await tick()
    expect(actions.logError).toHaveBeenCalled()
    expect(service.state.value).toEqual(`waiting`)
  })

  it(`logs errors during query running and transitions to waiting`, async () => {
    const service = interpret(machine)
    services.runQueries.mockImplementationOnce(throwService)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    await tick()
    expect(actions.logError).toHaveBeenCalled()
    expect(service.state.value).toEqual(`waiting`)
  })

  it(`panics on errors when launching webpack`, async () => {
    const service = interpret(machine)
    services.startWebpackServer.mockImplementationOnce(throwService)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    service.send(`done.invoke.run-queries`)
    await tick()
    expect(actions.panic).toHaveBeenCalled()
  })

  it(`logs errors during compilation and transitions to waiting`, async () => {
    const service = interpret(machine)
    services.recompile.mockImplementationOnce(throwService)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    service.state.context.compiler = {} as any
    service.state.context.sourceFilesDirty = true
    service.send(`done.invoke.run-queries`)
    await tick()
    expect(actions.logError).toHaveBeenCalled()
    expect(service.state.value).toEqual(`waiting`)
  })

  it(`panics on errors while waiting`, async () => {
    const service = interpret(machine)
    services.waitForMutations.mockImplementationOnce(throwService)
    service.start()
    service.send(`done.invoke.initialize`)
    service.send(`done.invoke.initialize-data`)
    service.send(`done.invoke.post-bootstrap`)
    service.state.context.compiler = {} as any
    service.send(`done.invoke.run-queries`)
    await tick()
    expect(actions.panic).toHaveBeenCalled()
  })
})
