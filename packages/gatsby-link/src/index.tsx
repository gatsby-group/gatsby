import PropTypes from "prop-types"
import React, {
  MutableRefObject,
  ReactElement,
  HTMLAttributes,
  CSSProperties,
} from "react"
import {
  Link as ReachRouterLink,
  Location,
  NavigateOptions,
} from "@gatsbyjs/reach-router"
import { parsePath } from "./parse-path"
import { isLocalLink } from "./is-local-link"
import { rewriteLinkPath } from "./rewrite-link-path"
import { withPrefix, getGlobalPathPrefix } from "./prefix-helpers"

export { parsePath, withPrefix }

export function withAssetPrefix(path): string {
  return withPrefix(path, getGlobalPathPrefix())
}

const NavLinkPropTypes = {
  activeClassName: PropTypes.string,
  activeStyle: PropTypes.object,
  partiallyActive: PropTypes.bool,
}

// Set up IntersectionObserver
const createIntersectionObserver = (
  el: Element,
  cb: (arg0: boolean) => void
): { instance: IntersectionObserver; el: Element } => {
  const io = new window.IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (el === entry.target) {
        // Check if element is within viewport, remove listener, destroy observer, and run link callback.
        // MSEdge doesn't currently support isIntersecting, so also test for  an intersectionRatio > 0
        cb(entry.isIntersecting || entry.intersectionRatio > 0)
      }
    })
  })

  // Add element to the observer
  io.observe(el)

  return { instance: io, el }
}

interface IGatsbyLinkProps extends HTMLAttributes<HTMLElement> {
  _location: {
    pathname: string
    search: string
  }
  innerRef: MutableRefObject<HTMLElement>
  to: string
  target: string
  partiallyActive: boolean
  activeClassName: string
  activeStyle: CSSProperties
  getProps: (arg0: unknown) => HTMLAttributes<HTMLElement> | null
  replace: boolean
  state: Record<string, unknown>
}

interface IGatsbyLinkState {
  IOSupported: boolean
}

class GatsbyLink extends React.Component<IGatsbyLinkProps, IGatsbyLinkState> {
  readonly state: IGatsbyLinkState = {
    IOSupported:
      // Default to no support for IntersectionObserver
      typeof window !== `undefined` && window.IntersectionObserver
        ? true
        : false,
  }

  abortPrefetch: { abort: () => void } | null = null
  io: { instance: IntersectionObserver; el: Element } | undefined

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  _prefetch() {
    let currentPath = window.location.pathname + window.location.search

    // reach router should have the correct state
    if (this.props._location && this.props._location.pathname) {
      currentPath = this.props._location.pathname + this.props._location.search
    }

    const rewrittenPath = rewriteLinkPath(this.props.to, currentPath)
    const parsed = parsePath(rewrittenPath)

    const newPathName = parsed.pathname + parsed.search

    // Prefetch is used to speed up next navigations. When you use it on the current navigation,
    // there could be a race-condition where Chrome uses the stale data instead of waiting for the network to complete
    if (currentPath !== newPathName) {
      return window.___loader.enqueue(newPathName)
    }

    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  componentWillUnmount() {
    if (!this.io) {
      return
    }
    const { instance, el } = this.io

    if (this.abortPrefetch) {
      this.abortPrefetch.abort()
    }

    instance.unobserve(el)
    instance.disconnect()
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  handleRef(ref) {
    if (
      this.props.innerRef &&
      Object.prototype.hasOwnProperty.call(this.props.innerRef, `current`)
    ) {
      this.props.innerRef.current = ref
    } else if (this.props.innerRef) {
      this.props.innerRef(ref)
    }

    if (this.state.IOSupported && ref) {
      // If IO supported and element reference found, setup Observer functionality
      this.io = createIntersectionObserver(ref, inViewPort => {
        if (inViewPort) {
          this.abortPrefetch = this._prefetch() as { abort: () => void } | null
        } else {
          if (this.abortPrefetch) {
            this.abortPrefetch.abort()
          }
        }
      })
    }
  }

  defaultGetProps = ({
    isPartiallyCurrent,
    isCurrent,
  }): HTMLAttributes<HTMLElement> | null => {
    if (this.props.partiallyActive ? isPartiallyCurrent : isCurrent) {
      return {
        className: [this.props.className, this.props.activeClassName]
          .filter(Boolean)
          .join(` `),
        style: { ...this.props.style, ...this.props.activeStyle },
      }
    }
    return null
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  render() {
    const {
      to,
      getProps = this.defaultGetProps,
      onClick,
      onMouseEnter,
      /* eslint-disable no-unused-vars */
      activeClassName: $activeClassName,
      activeStyle: $activeStyle,
      innerRef: $innerRef,
      partiallyActive,
      state,
      replace,
      _location,
      /* eslint-enable no-unused-vars */
      ...rest
    } = this.props

    if (process.env.NODE_ENV !== `production` && !isLocalLink(to)) {
      console.warn(
        `External link ${to} was detected in a Link component. Use the Link component only for internal links. See: https://gatsby.dev/internal-links`
      )
    }

    const prefixedTo = rewriteLinkPath(to, _location.pathname)
    if (!isLocalLink(prefixedTo)) {
      return <a href={prefixedTo} {...rest} />
    }

    return (
      <ReachRouterLink
        to={prefixedTo}
        state={state}
        getProps={getProps}
        innerRef={this.handleRef}
        onMouseEnter={(e): void => {
          if (onMouseEnter) {
            onMouseEnter(e)
          }
          const parsed = parsePath(prefixedTo)
          window.___loader.hovering(parsed.pathname + parsed.search)
        }}
        onClick={(e): boolean => {
          if (onClick) {
            onClick(e)
          }

          if (
            e.button === 0 && // ignore right clicks
            !this.props.target && // let browser handle "target=_blank"
            !e.defaultPrevented && // onClick prevented default
            !e.metaKey && // ignore clicks with modifier keys...
            !e.altKey &&
            !e.ctrlKey &&
            !e.shiftKey
          ) {
            e.preventDefault()

            let shouldReplace = replace
            const isCurrent = encodeURI(prefixedTo) === _location.pathname

            if (typeof replace !== `boolean` && isCurrent) {
              shouldReplace = true
            }
            // Make sure the necessary scripts and data are
            // loaded before continuing.
            window.___navigate(prefixedTo, {
              state,
              replace: shouldReplace,
            })
          }

          return true
        }}
        {...rest}
      />
    )
  }
}

function GatsbyLinkLocationWrapper(props): ReactElement {
  return (
    <Location>
      {({ location }): ReactElement => (
        <GatsbyLink {...props} _location={location} />
      )}
    </Location>
  )
}

export interface ILinkProps extends React.HTMLProps<ILinkProps> {
  to: string
  activeClassName: string
  activeStyle: CSSProperties
}

export const Link = React.forwardRef<ILinkProps, ILinkProps>((props, ref) => (
  <GatsbyLinkLocationWrapper innerRef={ref} {...props} />
))

export const navigate = (to: string, options?: NavigateOptions): void => {
  window.___navigate(rewriteLinkPath(to, window.location.pathname), options)
}
