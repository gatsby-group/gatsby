import Typography from "typography"
import theme from "typography-theme-bootstrap"

theme.overrideThemeStyles = ({ rhythm, scale }, options) => {
  return {
    "h1, h2, h3": {
      ...scale(1 / 6),
      fontWeight: `normal`,
      color: `#999`,
      lineHeight: `1.2`,
    },
    "code, kbd, pre, samp": {
      fontFamily: `Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`,
    },
    code: {
      fontSize: `90%`,
    },
    "h1 code, h2 code": {
      color: `#112`,
      fontWeight: `bold`,
    },
    "p > code": {
      background: `#fcf1e8`,
      color: `#452108`,
      padding: `.1rem .3rem`,
    },
    a: {
      color: `inherit`,
      textDecoration: `none`,
      transition: `background 0.2s ease-out`,
      boxShadow: `inset 0 -2px 0px 0px #cdecf9`,
      textShadow: `0.03em 0 #fff, -0.03em 0 #fff, 0 0.03em #fff, 0 -0.03em #fff, 0.06em 0 #fff, -0.06em 0 #fff, 0.09em 0 #fff, -0.09em 0 #fff, 0.12em 0 #fff, -0.12em 0 #fff, 0.15em 0 #fff, -0.15em 0 #fff`,
    },
    "a:hover": {
      background: `#cdecf9`,
      textShadow: `none`,
    },
    "a > code": {
      fontWeight: `bold`,
    },
    img: {
      borderRadius: `2px`,
      margin: `0`,
    },
    // Borrowed from https://github.com/comfusion/after-dark/
    // See https://github.com/comfusion/after-dark/blob/8fdbe2f480ac40315cf0e01cece785d2b5c4b0c3/layouts/partials/critical-theme.css#L36-L39
    "a[href*='//']:after": {
      content: `" " url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20class='i-external'%20viewBox='0%200%2032%2032'%20width='14'%20height='14'%20fill='none'%20stroke='%23cdecf9'%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='9.38%'%3E%3Cpath%20d='M14%209%20L3%209%203%2029%2023%2029%2023%2018%20M18%204%20L28%204%2028%2014%20M28%204%20L14%2018'/%3E%3C/svg%3E")`,
    },
    "a[href*='//']:hover:after": {
      content: `" " url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20class='i-external'%20viewBox='0%200%2032%2032'%20width='14'%20height='14'%20fill='none'%20stroke='%23000000'%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='9.38%'%3E%3Cpath%20d='M14%209%20L3%209%203%2029%2023%2029%2023%2018%20M18%204%20L28%204%2028%2014%20M28%204%20L14%2018'/%3E%3C/svg%3E")`,
    },
  }
}

const typography = new Typography(theme)

// Remove the below once Typography is upgraded for ES6
export default typography

export const rhythm = typography.rhythm
export const scale = typography.scale
export const options = typography.options
