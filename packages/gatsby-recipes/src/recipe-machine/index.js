const { Machine, assign, send } = require(`xstate`)

const debug = require(`debug`)(`recipes-machine`)

const createPlan = require(`../create-plan`)
const applyPlan = require(`../apply-plan`)
const validateSteps = require(`../validate-steps`)
const parser = require(`../parser`)
const { setInput } = require(`../renderer`)

const recipeMachine = Machine(
  {
    id: `recipe`,
    initial: `parsingRecipe`,
    context: {
      recipePath: null,
      projectRoot: null,
      currentStep: 0,
      steps: [],
      exports: [],
      plan: [],
      commands: [],
      stepResources: [],
      stepsAsMdx: [],
      exportsAsMdx: [],
      inputs: {},
    },
    states: {
      parsingRecipe: {
        invoke: {
          id: `parseRecipe`,
          src: async (context, _event) => {
            let parsed

            debug(`parsingRecipe`)

            if (context.src) {
              parsed = await parser.parse(context.src)
            } else if (context.recipePath && context.projectRoot) {
              parsed = await parser(context.recipePath, context.projectRoot)
            } else {
              throw new Error(
                JSON.stringify({
                  validationError: `A recipe must be specified`,
                })
              )
            }

            debug(`parsedRecipe`)

            return parsed
          },
          onError: {
            target: `doneError`,
            actions: assign({
              error: (context, event) => {
                debug(`error parsing recipes`)

                let msg
                try {
                  msg = JSON.parse(event.data.message)
                  return msg
                } catch (e) {
                  console.log(e)
                  return {
                    error: `Could not parse recipe ${context.recipePath}`,
                    e,
                  }
                }
              },
            }),
          },
          onDone: {
            target: `validateSteps`,
            actions: assign({
              steps: (context, event) => event.data.stepsAsMdx,
              exports: (context, event) => event.data.exportsAsMdx,
            }),
          },
        },
      },
      validateSteps: {
        invoke: {
          id: `validateSteps`,
          src: async (context, event) => {
            debug(`validatingSteps`)
            const result = await validateSteps(context.steps)
            if (result.length > 0) {
              debug(`errors found in validation`)
              throw new Error(JSON.stringify(result))
            }

            return undefined
          },
          onDone: `creatingPlan`,
          onError: {
            target: `doneError`,
            actions: assign({
              error: (context, event) => JSON.parse(event.data.message),
            }),
          },
        },
      },
      creatingPlan: {
        entry: [`deleteOldPlan`],
        invoke: {
          id: `createPlan`,
          src: (context, event) => async (cb, onReceive) => {
            try {
              const result = await createPlan(context, cb)
              return result
            } catch (e) {
              console.log(e)
              throw e
            }
          },
          onDone: {
            target: `presentPlan`,
            actions: assign({
              plan: (context, event) => event.data,
            }),
          },
          onError: {
            target: `doneError`,
            actions: assign({
              error: (context, event) => event.data?.errors || event.data,
            }),
          },
        },
        on: {
          INVALID_PROPS: {
            target: `doneError`,
            actions: assign({
              error: (context, event) => event.data,
            }),
          },
        },
      },
      presentPlan: {
        invoke: {
          id: `presentingPlan`,
          src: (context, event) => (cb, onReceive) => {
            console.log(`yo in the invoked presentingPlan`)
            onReceive(async e => {
              console.log(`onReceive`, e, setInput)
              // const result = await setInput(e.data)
              // console.log({ contextInputs: context.inputs })
              context.inputs = context.inputs || {}
              context.inputs[e.data.key] = e.data
              // console.log(context.inputs)
              const result = await createPlan(context, cb)
              console.log({ result })
              cb({ type: `onUpdatePlan`, data: result })
            })

            cb(`yo`)

            return () => console.log(`done I guess`)
          },
        },
        // entry: send(`YO`, { to: `presentingPlan` }),
        on: {
          CONTINUE: `applyingPlan`,
          // INPUT_ADDED: (context, event) => {
          // console.log(`in the callback`, { context, event })
          // },
          INPUT_ADDED: {
            actions: send((context, event) => event, { to: `presentingPlan` }),
          },
          onUpdatePlan: {
            actions: assign({
              plan: (context, event) => event.data,
            }),
          },
        },
      },
      applyingPlan: {
        // cb mechanism can be used to emit events/actions between UI and the server/renderer
        // https://xstate.js.org/docs/guides/communication.html#invoking-callbacks
        invoke: {
          id: `applyPlan`,
          src: (context, event) => cb => {
            debug(`applying plan`)
            cb(`RESET`)
            if (context.plan.length === 0) {
              return cb(`onDone`)
            }

            const interval = setInterval(() => {
              cb(`TICK`)
            }, 10000)

            applyPlan(context, cb)
              .then(result => {
                debug(`applied plan`)
                cb({ type: `onDone`, data: result })
              })
              .catch(error => {
                debug(`error applying plan`)
                debug(error)
                cb({ type: `onError`, data: error })
              })

            return () => clearInterval(interval)
          },
        },
        on: {
          RESET: {
            actions: assign({
              elapsed: 0,
            }),
          },
          TICK: {
            actions: assign({
              elapsed: context => (context.elapsed += 10000),
            }),
          },
          onDone: {
            target: `hasAnotherStep`,
            actions: [`addResourcesToContext`],
          },
          onError: {
            target: `doneError`,
            actions: assign({ error: (context, event) => event.data }),
          },
        },
      },
      hasAnotherStep: {
        entry: [`incrementStep`],
        always: [
          {
            target: `creatingPlan`,
            // The 'searchValid' guard implementation details are
            // specified in the machine config
            cond: `hasNextStep`,
          },
          {
            target: `done`,
            // The 'searchValid' guard implementation details are
            // specified in the machine config
            cond: `atLastStep`,
          },
        ],
      },
      done: {
        type: `final`,
      },
      doneError: {
        type: `final`,
      },
    },
  },
  {
    actions: {
      incrementStep: assign((context, event) => {
        return {
          currentStep: context.currentStep + 1,
        }
      }),
      deleteOldPlan: assign((context, event) => {
        return {
          plan: [],
        }
      }),
      addResourcesToContext: assign((context, event) => {
        if (event.data) {
          let plan = context.plan || []
          plan = plan.map(p => {
            let changedResource = event.data.find(c => c._uuid === p._uuid)
            if (!changedResource) return p
            p._message = changedResource._message
            p.isDone = true
            return p
          })
          return {
            plan,
          }
        }
        return undefined
      }),
    },
    guards: {
      hasNextStep: (context, event) => false,
      // false || context.currentStep < context.steps.length,
      atLastStep: (context, event) => true,
      // true || context.currentStep === context.steps.length,
    },
  }
)

module.exports = recipeMachine
