// SSR entry for the build-time prerender (D12). Built with `vite build --ssr` and run by
// scripts/prerender.mjs in Node, so nothing here (or in what it renders) may touch `window`.
import { renderToString } from 'react-dom/server'
import { AppProvider } from '../app/AppContext.jsx'
import { ACH } from '../core/achievements.js'
import { createStore } from '../core/store.js'
import { PROFILE } from '../content/index.js'
import { buildPersonJsonLd } from './jsonld.js'
import Resume from './Resume.jsx'

const noop = () => {}

/** The slice of the app the résumé reads, with empty stores and a no-op nav. No DOM needed. */
export function createServerApp() {
  return {
    ach: { list: ACH, store: createStore({ got: new Set() }), unlock: () => false },
    nav: { goToResume: noop, openLaptop: noop, backToLaptop: noop },
  }
}

/** The résumé markup that replaces <!--resume-outlet--> in dist/index.html. */
export function renderResumeHtml() {
  return renderToString(
    <AppProvider app={createServerApp()}>
      <Resume />
    </AppProvider>,
  )
}

/** The schema.org Person injected before </head>. */
export function personJsonLd() {
  return buildPersonJsonLd(PROFILE)
}
