import React from "react"
import colors from "../utils/colors"
import Container from "../components/container"

export default () =>
  <Container>
    <h1 css={{ margin: 0 }}>Colors</h1>
    <div>
      <div css={{ float: `left`, marginRight: 3 }}>
        {colors.a.map(a =>
          <div css={{ height: 30, width: 30, background: a }} />
        )}
      </div>
      <div css={{ float: `left`, marginRight: 3 }}>
        {colors.b.map(a =>
          <div css={{ height: 30, width: 30, background: a }} />
        )}
      </div>
      <div css={{ float: `left`, marginRight: 3 }}>
        {colors.c.map(a =>
          <div css={{ height: 30, width: 30, background: a }} />
        )}
      </div>
    </div>
  </Container>
