import { useCookie, useFeedback } from "."
import { INTERACTION_COOKIE_NAME } from "../constants"
import pkgJSON from "../package.json"

const useTrackEvent = () => {
  const { setCookie, getCookie } = useCookie()
  const { shouldAskForFeedback, checkForFeedback } = useFeedback()
  const track = async ({ eventType, orgId, siteId, buildId, name }) => {
    checkForFeedback()
    if (shouldAskForFeedback) {
      const interactions = isNaN(parseInt(getCookie(INTERACTION_COOKIE_NAME)))
        ? 0
        : parseInt(getCookie(INTERACTION_COOKIE_NAME))
      setCookie(INTERACTION_COOKIE_NAME, interactions + 1)
    }
    if (process.env.GATSBY_TELEMETRY_API) {
      try {
        const body = {
          time: new Date(),
          eventType,
          componentId: `gatsby-plugin-gatsby-cloud_preview-indicator`,
          version: 1,
          componentVersion: pkgJSON.version,
          organizationId: orgId,
          siteId,
          buildId,
          name,
        }

        await fetch(process.env.GATSBY_TELEMETRY_API, {
          mode: `cors`,
          method: `POST`,
          headers: {
            "Content-Type": `application/json`,
          },
          body: JSON.stringify(body),
        })
      } catch (e) {
        console.log(e, e.message)
      }
    }
  }
  return {
    track,
  }
}

export default useTrackEvent
