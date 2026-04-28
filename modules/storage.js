/**
 * storage.js — chrome.storage.local wrapper for "Saved for Later" & "Recently Closed"
 */

export async function saveTabForLater(tab) {
  const { deferred = [] } = await chrome.storage.local.get('deferred')
  deferred.push({
    id:        Date.now().toString(),
    url:       tab.url,
    title:     tab.title,
    savedAt:   new Date().toISOString(),
    completed: false,
    dismissed: false,
  })
  await chrome.storage.local.set({ deferred })
}

export async function getSavedTabs() {
  const { deferred = [] } = await chrome.storage.local.get('deferred')
  const visible = deferred.filter(t => !t.dismissed)
  return {
    active:   visible.filter(t => !t.completed),
    archived: visible.filter(t => t.completed),
  }
}

export async function checkOffSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred')
  const tab = deferred.find(t => t.id === id)
  if (tab) {
    tab.completed = true
    tab.completedAt = new Date().toISOString()
    await chrome.storage.local.set({ deferred })
  }
}

export async function dismissSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred')
  const tab = deferred.find(t => t.id === id)
  if (tab) {
    tab.dismissed = true
    await chrome.storage.local.set({ deferred })
  }
}

// ── Recently Closed (Tab Recovery) ──────────────────────────────────────

const RECENTLY_CLOSED_KEY = 'recentlyClosed'
const MAX_RECENTLY_CLOSED = 20 // keep last 20 closed tabs

export async function addRecentlyClosed(tab) {
  const { [RECENTLY_CLOSED_KEY]: list = [] } = await chrome.storage.local.get(RECENTLY_CLOSED_KEY)
  // Avoid exact duplicates (same URL)
  const filtered = list.filter(t => t.url !== tab.url)
  const entry = {
    id:      Date.now().toString(),
    url:     tab.url,
    title:   tab.title || tab.url,
    favicon: tab.favIconUrl || '',
    closedAt: new Date().toISOString(),
  }
  const updated = [entry, ...filtered].slice(0, MAX_RECENTLY_CLOSED)
  await chrome.storage.local.set({ [RECENTLY_CLOSED_KEY]: updated })
}

export async function getRecentlyClosed() {
  const { [RECENTLY_CLOSED_KEY]: list = [] } = await chrome.storage.local.get(RECENTLY_CLOSED_KEY)
  return list
}

export async function removeRecentlyClosed(id) {
  const { [RECENTLY_CLOSED_KEY]: list = [] } = await chrome.storage.local.get(RECENTLY_CLOSED_KEY)
  const updated = list.filter(t => t.id !== id)
  await chrome.storage.local.set({ [RECENTLY_CLOSED_KEY]: updated })
}

export async function clearRecentlyClosed() {
  await chrome.storage.local.set({ [RECENTLY_CLOSED_KEY]: [] })
}

// ── Tab-change heartbeat (triggers auto-refresh in newtab page) ──────────────
// background.js writes a timestamp here on every tab change.
// main.js listens to chrome.storage.onChanged and re-renders when this changes.
const TAB_CHANGE_KEY = 'lastTabChange'

export async function markTabChanged() {
  await chrome.storage.local.set({ [TAB_CHANGE_KEY]: Date.now() })
}
