import * as React from "react"

export interface FixedObject {
  width: number
  height: number
  src: string
  srcSet: string
  base64?: string | null
  tracedSVG?: string | null
  srcWebp?: string | null
  srcSetWebp?: string | null
  media?: string | null
}

export interface FluidObject {
  aspectRatio: number
  src: string
  srcSet: string
  sizes: string
  base64?: string | null
  tracedSVG?: string | null
  srcWebp?: string | null
  srcSetWebp?: string | null
  media?: string | null
}

interface GatsbyImageProps {
  resolutions?: FixedObject
  sizes?: FluidObject
  fixed?: FixedObject | FixedObject[] | null
  fluid?: FluidObject | FluidObject[] | null
  fadeIn?: boolean
  title?: string
  alt?: string
  className?: string | object
  critical?: boolean
  crossOrigin?: string | boolean
  style?: object
  imgStyle?: object
  placeholderStyle?: object
  backgroundColor?: string | boolean
  onLoad?: () => void
  onStartLoad?: (param: { wasCached: boolean }) => void
  onError?: (event: any) => void
  Tag?: string
  itemProp?: string
  loading?: `auto` | `lazy` | `eager`
  draggable?: boolean
}

export default class GatsbyImage extends React.Component<
  GatsbyImageProps,
  any
> {}
