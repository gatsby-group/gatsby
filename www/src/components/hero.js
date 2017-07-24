import CtaButton from "./cta-button"
import { rhythm, scale, options } from "../utils/typography"
import presets from "../utils/presets"
import ArrowForwardIcon from "react-icons/lib/md/arrow-forward"

const vP = rhythm(presets.vPR)
const vPHd = rhythm(presets.vPHdR)
const vPVHd = rhythm(presets.vPVHdR)
const vPVVHd = rhythm(presets.vPVVHdR)

const vPOff = rhythm(presets.vPR - presets.logoWidth)
const vPHdOff = rhythm(presets.vPHdR - presets.logoWidth)
const vPVHdOff = rhythm(presets.vPVHdR - presets.logoWidth)
const vPVVHdOff = rhythm(presets.vPVVHdR - presets.logoWidth)

const verticalPadding = {
  paddingLeft: vP,
  paddingRight: vP,
  [presets.Hd]: {
    paddingLeft: vPHd,
    paddingRight: vPHd,
  },
  [presets.VHd]: {
    paddingLeft: vPVHd,
    paddingRight: vPVHd,
  },
  [presets.VVHd]: {
    paddingLeft: vPVVHd,
    paddingRight: vPVVHd,
  },
}

const HeroUnitBackground = ({ position }) =>
  <div
    className="heroUnitBackground"
    css={{
      position: position,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      zIndex: -1,
      background: `white`,
    }}
  >
    <div
      css={{
        position: `absolute`,
        width: vPOff,
        bottom: 0,
        left: 0,
        top: 0,
        zIndex: -10,
        background: presets.heroBright,
        [presets.Hd]: {
          width: vPHdOff,
        },
        [presets.VHd]: {
          width: vPVHdOff,
        },
        [presets.VVHd]: {
          width: vPVVHdOff,
        },
      }}
    />
    <div
      className="heroUnitBackground-right"
      css={{
        position: `absolute`,
        right: 0,
        bottom: 0,
        left: position === `absolute` ? `25%` : `0`,
        top: 0,
        width: `100%`,
        height: `100%`,
        zIndex: -1,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 400 400"
        preserveAspectRatio="xMinYMin slice"
        style={{ width: `100%`, height: `100%` }}
      >
        <style type="text/css">
          {`
            .st0 { fill: ${presets.heroMid}; }
    	      .st1 { fill: ${presets.heroDark}; }
            .lg {
              display: none;
            }
            @media screen and (min-width: 960px) and (min-height: 600px) {
              .lg {
                display: block;
              }
            }
          `}
        </style>
        <polygon
          className="st0 sm"
          points="-230,571.8 456.8,-115 1090,-115 1090,571.8 "
        />
        <polygon
          className="st1 sm"
          points="-130,571.8 556.8,-115 1586.2,-115 1586.2,571.8 "
        />

        <polygon
          className="st0 lg"
          points="-200,460 486.8,-226.8 1120,-226.8 1120,460 "
        />
        <polygon
          className="st1 lg"
          points="-140,460 546.8,-226.8 1576.2,-226.8 1576.2,460 "
        />
      </svg>
    </div>
    <div
      className="heroUnitBackground-left"
      css={{
        position: `absolute`,
        right: 0,
        left: vPOff,
        top: 0,
        bottom: 0,
        zIndex: -2,
        [presets.Hd]: {
          left: vPHdOff,
        },
        [presets.VHd]: {
          left: vPVHdOff,
        },
        [presets.VVHd]: {
          left: vPVVHdOff,
        },
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 10000 10000"
        xmlSpace="preserve"
        preserveAspectRatio="xMinYMin slice"
        style={{ width: `100%`, height: `100%` }}
      >
        <style type="text/css">
          {`.st9{ fill:${presets.heroBright}; }`}
        </style>
        <polygon
          className="st9"
          points="-5000,-5000 15000,15000 -5000,15000 "
        />
      </svg>
    </div>
  </div>

const HeroUnit = () =>
  <div
    className="heroUnit"
    css={{
      padding: rhythm(3 / 4),
      paddingLeft: rhythm(1.5),
      paddingTop: rhythm(4),
      paddingBottom: rhythm(4),
      position: `relative`,
      width: rhythm(14),
      [presets.Mobile]: {
        //background: `rgba(255,255,0,0.2)`,
      },
      [presets.Phablet]: {
        width: rhythm(17),
        //background: `rgba(255,200,0,0.1)`,
      },
      [presets.Tablet]: {
        width: rhythm(17),
        //background: `rgba(255,100,0,0.1)`,
      },
      [presets.Desktop]: {
        width: rhythm(17),
        //background: `red`,
        paddingTop: rhythm(5),
      },
      [presets.Hd]: {
        paddingLeft: vPHd,
        width: rhythm(22),
      },
      [presets.VHd]: {
        paddingLeft: vPVHd,
        width: rhythm(29),
      },
      [presets.VVHd]: {
        paddingBottom: rhythm(6),
        paddingLeft: vPVVHd,
        width: rhythm(30),
      },
    }}
  >
    <h1
      css={{
        color: presets.brand,
        ...scale(0.8),
        margin: 0,
        marginBottom: `1.2em`,
        padding: 0,
        lineHeight: 1,
        [presets.Mobile]: {
          fontSize: scale(1).fontSize,
        },
        [presets.Tablet]: {
          fontSize: scale(1.2).fontSize,
        },
        [presets.Hd]: {
          fontSize: scale(1.4).fontSize,
        },
        [presets.VHd]: {
          fontSize: scale(1.75).fontSize,
        },
      }}
    >
      Blazing-fast static site generator for React
    </h1>
    <CtaButton to="/docs/">
      <span css={{ verticalAlign: `middle` }}>Get Started</span>
      {` `}
      <ArrowForwardIcon
        css={{ verticalAlign: `baseline`, marginLeft: `.2em` }}
      />
    </CtaButton>
  </div>

const Hero = () =>
  <div
    css={{
      position: `relative`,
    }}
  >
    <HeroUnitBackground position="fixed" />
    <HeroUnit />
  </div>

export default Hero
