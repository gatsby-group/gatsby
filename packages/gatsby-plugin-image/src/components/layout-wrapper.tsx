import React, { Fragment, FunctionComponent, PropsWithChildren } from "react"
import { Layout } from "../image-utils"

export interface ILayoutWrapperProps {
  layout: Layout
  width: number
  height: number
}

export function getSizer(
  layout: Layout,
  width: number,
  height: number
): string {
  let sizer = ``
  if (layout === `fullWidth`) {
    sizer = `<div aria-hidden="true" style="padding-top: ${
      (height / width) * 100
    }%;"></div>`
  }

  if (layout === `constrained`) {
    sizer = `<div style="max-width: ${width}px; display: block;"><img alt="" role="presentation" aria-hidden="true" src="data:image/svg+xml;charset=utf-8,%3Csvg%20height='${height}'%20width='${width}'%20xmlns='http://www.w3.org/2000/svg'%20version='1.1'%3E%3C/svg%3E" style="max-width: 100%; display: block; position: static;"></div>`
  }

  return sizer
}

const Sizer: FunctionComponent<ILayoutWrapperProps> = function Sizer({
  layout,
  width,
  height,
}) {
  if (layout === `fullWidth`) {
    return (
      <div aria-hidden style={{ paddingTop: `${(height / width) * 100}%` }} />
    )
  }

  if (layout === `constrained`) {
    return (
      <div style={{ maxWidth: width, display: `block` }}>
        <img
          alt=""
          role="presentation"
          aria-hidden="true"
          src={`data:image/svg+xml;charset=utf-8,%3Csvg%20height='${height}'%20width='${width}'%20xmlns='http://www.w3.org/2000/svg'%20version='1.1'%3E%3C/svg%3E`}
          style={{
            maxWidth: `100%`,
            display: `block`,
            position: `static`,
          }}
        />
      </div>
    )
  }

  return null
}

export const LayoutWrapper: FunctionComponent<
  PropsWithChildren<ILayoutWrapperProps>
> = function LayoutWrapper({ children, ...props }) {
  return (
    <Fragment>
      <Sizer {...props} />
      {children}
    </Fragment>
  )
}
