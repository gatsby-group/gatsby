import * as React from "react"
import { Link } from "gatsby"
import { ScriptResourceRecords } from "../components/script-resource-records"
import { useOccupyMainThread } from "../hooks/use-occupy-main-thread"
import { scripts, scriptUrls } from "../../scripts"
import { onLoad } from "../utils/on-load"
import "../styles/global.css"

// TODO - Import from gatsby core after gatsby-script is in general availability
import { Script, ScriptStrategy } from "gatsby-script"

function IndexPage() {
  useOccupyMainThread()

  return (
    <main>
      <h1>Script component e2e test</h1>

      <br />
      <h2>Scripts with sources</h2>
      <ScriptResourceRecords
        check={record =>
          scriptUrls.has(record.name) || record.name.includes(`framework`)
        }
        count={4}
      />

      <br />
      <ul>
        <li>
          <a href="/" id="anchor-link-back-to-index">
            Back to index (anchor)
          </a>
        </li>
        <li>
          <Link to="/" id="gatsby-link-back-to-index">
            Back to index (gatsby-link)
          </Link>
        </li>
      </ul>

      <Script
        src={scripts.dayjs}
        strategy={ScriptStrategy.preHydrate}
        onLoad={() => onLoad(ScriptStrategy.preHydrate)}
      />
      <Script
        src={scripts.three}
        strategy={ScriptStrategy.postHydrate}
        onLoad={() => onLoad(ScriptStrategy.postHydrate)}
      />
      <Script
        src={scripts.marked}
        strategy={ScriptStrategy.idle}
        onLoad={() => onLoad(ScriptStrategy.idle)}
      />
    </main>
  )
}

export default IndexPage
