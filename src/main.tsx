import React from 'react'
import ReactDOM from 'react-dom/client'

import '@/app/globals.css'
import { App } from '@/src/app'
import { currentCourtSite } from '@/lib/court-sites'

const courtTheme = currentCourtSite()?.theme
if (courtTheme) document.documentElement.dataset.courtTheme = courtTheme

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
