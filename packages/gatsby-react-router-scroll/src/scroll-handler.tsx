import * as React from "react"
import { LocationContext } from "@gatsbyjs/reach-router"
import PropTypes from "prop-types"
import { SessionStorage } from "./session-storage"

export const ScrollContext = React.createContext<SessionStorage>(
  new SessionStorage()
)
ScrollContext.displayName = `GatsbyScrollContext`

type ShouldUpdateScrollFn = (
  prevRouterProps: LocationContext | undefined,
  routerProps: LocationContext
) => boolean
type ShouldUpdateScroll = undefined | ShouldUpdateScrollFn

export class ScrollHandler extends React.Component<
  LocationContext & { shouldUpdateScroll: ShouldUpdateScroll }
> {
  static propTypes = {
    shouldUpdateScroll: PropTypes.func,
    children: PropTypes.element.isRequired,
    location: PropTypes.object.isRequired,
  }

  _stateStorage: SessionStorage = new SessionStorage()

  // @see https://www.html5rocks.com/en/tutorials/speed/animations/
  _isTicking = false
  _latestKnownScrollY = 0
  scrollListener = (): void => {
    this._latestKnownScrollY = window.scrollY

    if (!this._isTicking) {
      this._isTicking = true
      requestAnimationFrame(this._saveScroll.bind(this))
    }
  }

  _saveScroll(): void {
    const key = this.props.location.key || null

    if (key) {
      this._stateStorage.save(
        this.props.location,
        key,
        this._latestKnownScrollY
      )
    }
    this._isTicking = false
  }

  componentDidMount(): void {
    // scrollRestoration can trigger scroll event before location has been updated (race condition)
    history.scrollRestoration = `manual`
    window.addEventListener(`scroll`, this.scrollListener)
    let scrollPosition
    const { key, hash } = this.props.location

    if (key) {
      scrollPosition = this._stateStorage.read(this.props.location, key)
    }

    /** If a hash is present in the browser url as the component mounts (i.e. the user is navigating
     * from an external website) then scroll to the hash instead of any previously stored scroll
     * position. */
    if (hash) {
      this.scrollToHash(decodeURI(hash), undefined)
    } else if (scrollPosition) {
      this.windowScroll(scrollPosition, undefined)
    }
  }

  componentWillUnmount(): void {
    window.removeEventListener(`scroll`, this.scrollListener)
  }

  componentDidUpdate(prevProps: LocationContext): void {
    const { hash, key } = this.props.location
    let scrollPosition

    if (key) {
      scrollPosition = this._stateStorage.read(this.props.location, key)
    }

    /**  There are two pieces of state: the browser url and
     * history state which keeps track of scroll position
     * Native behaviour prescribes that we ought to restore scroll position
     * when a user navigates back in their browser (this is the `POP` action)
     * Currently, reach router has a bug that prevents this at https://github.com/reach/router/issues/228
     * So we _always_ stick to the url as a source of truth — if the url
     * contains a hash, we scroll to it
     */

    if (hash) {
      this.scrollToHash(decodeURI(hash), prevProps)
    } else {
      this.windowScroll(scrollPosition, prevProps)
    }
  }

  windowScroll = (
    position: number,
    prevProps: LocationContext | undefined
  ): void => {
    if (this.shouldUpdateScroll(prevProps, this.props)) {
      window.scrollTo(0, position)
    }
  }

  scrollToHash = (
    hash: string,
    prevProps: LocationContext | undefined
  ): void => {
    const node = document.getElementById(hash.substring(1))

    if (node && this.shouldUpdateScroll(prevProps, this.props)) {
      node.scrollIntoView()
    }
  }

  shouldUpdateScroll = (
    prevRouterProps: LocationContext | undefined,
    routerProps: LocationContext
  ): boolean => {
    const { shouldUpdateScroll } = this.props
    if (!shouldUpdateScroll) {
      return true
    }

    // Hack to allow accessing this._stateStorage.
    return shouldUpdateScroll.call(this, prevRouterProps, routerProps)
  }

  render(): React.ReactNode {
    return (
      <ScrollContext.Provider value={this._stateStorage}>
        {this.props.children}
      </ScrollContext.Provider>
    )
  }
}
