/**
 * main.js — TabNest v3 entry point
 */

import { initTheme }                      from './modules/ui.js'
import { initI18n }                       from './modules/i18n.js'
import { initEvents, initRecentlyClosed } from './modules/events.js'
import { renderDashboard }                from './modules/render.js'
import { initClock }                      from './modules/clock.js'
import { initSearch }                     from './modules/search.js'
import { initBookmarks }                  from './modules/bookmarks.js'
import { initDrawer, updateDrawerCount, openDrawerToSearch }  from './modules/drawer.js'
import { initWallpaper }                  from './modules/wallpaper.js'
import { initWeather }                    from './modules/weather.js'
import { initHitokoto }                   from './modules/hitokoto.js'
import { initZen }                        from './modules/zen.js'
import { initSettings }                   from './modules/settings.js'

// Global error handler for debugging
window.addEventListener('error', (e) => {
  console.error('[tabnest] Runtime error:', e.message, 'at', e.filename + ':' + e.lineno)
})

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('[main] Starting boot...')

    // 1. Language (before first paint to avoid flash)
    await initI18n()
    console.log('[main] initI18n done')

    // 2. Theme
    await initTheme()
    console.log('[main] initTheme done')

    // 3. Wallpaper (before render)
    await initWallpaper()
    console.log('[main] initWallpaper done')

    // 4. Clock + Date (instant, no async)
    initClock()
    console.log('[main] initClock done')

    // 4b. Weather (async, non-blocking - shows cache first)
    initWeather()
    console.log('[main] initWeather triggered')

    // 4c. Hitokoto quote (async, non-blocking - shows cache first)
    // Don't await! Let it run in background and show cached data immediately
    initHitokoto()
    console.log('[main] initHitokoto triggered')

    // 4d. Zen mode (keyboard shortcut Z)
    initZen()
    console.log('[main] initZen done')

    // 4e. Settings panel
    console.log('[main] About to call initSettings...')
    await initSettings()
    console.log('[main] initSettings done')

    // 5. Search bar (needs await - blocks if no cached engine)
    await initSearch()
    console.log('[main] initSearch done')

    // 6. Quick links (needs await - uses chrome.storage.local)
    await initBookmarks()
    console.log('[main] initBookmarks done')

    // 7. Tabs drawer
    initDrawer()
    console.log('[main] initDrawer done')

    // 7b. "Search tabs" shortcut button under main search
    const searchTabsBtn = document.getElementById('searchTabsBtn')
    if (searchTabsBtn) {
      searchTabsBtn.addEventListener('click', () => openDrawerToSearch())
    }

    // 8. Event delegation (tab management)
    initEvents()
    console.log('[main] initEvents done')

    // 9. Recently closed panel
    await initRecentlyClosed()
    console.log('[main] initRecentlyClosed done')

    // 10. First render of tab groups
    await renderDashboard()
    updateDrawerCount()
    console.log('[main] renderDashboard done - boot complete!')
  } catch (err) {
    console.error('[tabnest] Boot error:', err)
    console.error(err.stack)
  }

  // 8. Auto-refresh: background.js writes lastTabChange to storage on every tab event.
  //    chrome.storage.onChanged fires regardless of which tab is active, so this works
  //    even when the newtab page is in the background or on another window.
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && 'lastTabChange' in changes) {
        renderDashboard().catch(console.error)
        initRecentlyClosed().catch(console.error)
        updateDrawerCount()
      }
    })
  }
})