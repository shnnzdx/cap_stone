import { HashRouter } from 'react-router-dom'
import FinalApp from './final/FinalApp'
import './final/tokens.css'
import './final/final.css'

/**
 * The trip workspace is embedded under /trip-app/ in the main Vinext site.
 * Hash routing keeps organizer and guest deep links reload-safe inside the
 * static sub-application.
 */
export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <FinalApp />
    </HashRouter>
  )
}
