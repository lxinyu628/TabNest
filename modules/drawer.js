/**
 * drawer.js — Tab management drawer (Phase 3)
 *
 * Opens/closes the tabs drawer from the bottom (iOS sheet style).
 * Manages toggle button count badge.
 * v3.1: Tab search filtering + open-to-search shortcut.
 */

import { t, getLang } from './i18n.js'
import { getOpenTabs } from './tabs.js'

let drawerOpen = false

// ── Open drawer ────────────────────────────────────────────────────────────
/**
 * @param {boolean} focusSearch - if true, auto-focus the tab search input
 */
function openDrawer(focusSearch = false) {
  const drawer = document.getElementById('tabsDrawer')
  const backdrop = document.getElementById('drawerBackdrop')
  if (!drawer) return

  drawer.classList.add('open')
  if (backdrop) backdrop.classList.add('visible')
  drawerOpen = true

  // Prevent body scroll + hide corner panel (settings button)
  document.body.style.overflow = 'hidden'
  document.body.classList.add('drawer-open')

  if (focusSearch) {
    // Delay to let CSS transition start, then focus
    setTimeout(() => {
      const searchInput = document.getElementById('tabSearchInput')
      if (searchInput) {
        searchInput.focus()
        searchInput.select()
      }
    }, 80)
  }
}

// ── Close drawer ──────────────────────────────────────────────────────────
export function closeDrawer() {
  const drawer = document.getElementById('tabsDrawer')
  const backdrop = document.getElementById('drawerBackdrop')
  if (!drawer) return

  drawer.classList.remove('open')
  if (backdrop) backdrop.classList.remove('visible')
  drawerOpen = false

  // Restore body scroll + show corner panel (settings button) again
  document.body.style.overflow = ''
  document.body.classList.remove('drawer-open')

  // Clear search when closing
  clearTabSearch()
}

// ── Toggle drawer ─────────────────────────────────────────────────────────
export function toggleDrawer(focusSearch = false) {
  if (drawerOpen) {
    closeDrawer()
  } else {
    openDrawer(focusSearch)
  }
}

// ── Open drawer and focus search (for main-page search integration) ────────
export function openDrawerToSearch() {
  openDrawer(true)
}

// ── Update toggle button count ────────────────────────────────────────────
export function updateDrawerCount() {
  const tabs = getOpenTabs()
  const count = tabs.length

  // Bottom bar stats
  const bottomStatOpen = document.getElementById('statTabsOpen')
  if (bottomStatOpen) {
    bottomStatOpen.textContent = count
  }
}

// ── Tab Search Logic ──────────────────────────────────────────────────────
function clearTabSearch() {
  const input = document.getElementById('tabSearchInput')
  const clearBtn = document.getElementById('tabSearchClear')
  if (input) input.value = ''
  if (clearBtn) clearBtn.style.display = 'none'
  applyTabSearch('')
}

/**
 * Filter domain cards by query.
 * Hides cards where neither domain label nor any tab title/url matches.
 */
function applyTabSearch(query) {
  const q = query.toLowerCase().trim()
  const grid = document.getElementById('openTabsMissions')
  if (!grid) return

  const cards = grid.querySelectorAll('.domain-card')
  let visibleCount = 0

  cards.forEach(card => {
    if (!q) {
      card.style.display = ''
      visibleCount++
      return
    }

    // Check domain label
    const nameEl = card.querySelector('.mission-name')
    const domainText = (nameEl?.textContent || '').toLowerCase()

    // Check individual tab titles / urls
    const pageChips = card.querySelectorAll('.page-chip')
    let tabMatches = false
    pageChips.forEach(chip => {
      const title = (chip.querySelector('.chip-text')?.textContent || '').toLowerCase()
      const href  = (chip.dataset.tabUrl || '').toLowerCase()
      if (title.includes(q) || href.includes(q)) tabMatches = true
    })

    if (domainText.includes(q) || tabMatches) {
      card.style.display = ''
      visibleCount++
    } else {
      card.style.display = 'none'
    }
  })

  // Show/hide no-results state
  let noResults = grid.querySelector('.drawer-no-results')
  if (q && visibleCount === 0) {
    if (!noResults) {
      noResults = document.createElement('div')
      noResults.className = 'drawer-no-results'
      noResults.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <span>${t('drawer.noResults') || '没有匹配的标签页'}</span>
      `
      grid.appendChild(noResults)
    }
    noResults.style.display = 'flex'
  } else if (noResults) {
    noResults.style.display = 'none'
  }
}

// ── Init drawer ────────────────────────────────────────────────────────────
export function initDrawer() {
  const closeBtn  = document.getElementById('drawerCloseBtn')
  const backdrop  = document.getElementById('drawerBackdrop')

  // Bottom bar organize button (main entry point)
  const bottomBarBtn = document.getElementById('quickOrganizeBtn')

  if (bottomBarBtn) {
    bottomBarBtn.addEventListener('click', () => toggleDrawer())
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeDrawer())
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => closeDrawer())
  }

  // ESC key to close drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerOpen) {
      closeDrawer()
    }
  })

  // ── Tab Search ──────────────────────────────────────────────────────────
  const tabSearchInput = document.getElementById('tabSearchInput')
  const tabSearchClear = document.getElementById('tabSearchClear')

  if (tabSearchInput) {
    tabSearchInput.addEventListener('input', () => {
      const q = tabSearchInput.value
      if (tabSearchClear) {
        tabSearchClear.style.display = q.trim() ? 'flex' : 'none'
      }
      applyTabSearch(q)
    })
  }

  if (tabSearchClear) {
    tabSearchClear.addEventListener('click', () => {
      clearTabSearch()
      tabSearchInput?.focus()
    })
  }

  // Init count
  updateDrawerCount()
}
