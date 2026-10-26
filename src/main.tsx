import React from 'react'
import ReactDOM from 'react-dom/client'

import '@/app/globals.css'
import { App } from '@/src/app'
import { currentCourtSite } from '@/lib/court-sites'

// Shared-project courts have no build-time VITE_COURT_NAME, so index.html's
// title placeholder is replaced here along with the court's theme.
const courtSite = currentCourtSite()
if (courtSite) {
  document.documentElement.dataset.courtTheme = courtSite.theme
  document.title = courtSite.name
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
