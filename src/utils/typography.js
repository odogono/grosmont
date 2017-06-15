import Typography from 'typography'
// import Wordpress2016 from 'typography-theme-wordpress-2016'
import FairyGates from 'typography-theme-fairy-gates'

const typography = new Typography(FairyGates)

// Hot reload typography in development.
if (process.env.NODE_ENV !== 'production') {
  typography.injectStyles()
}

export default typography
