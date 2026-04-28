/**
 * background.js — Service Worker for Organize Tab v2
 *
 * Responsibilities:
 * 1. Toolbar badge: shows open tab count (green / amber / red by volume)
 * 2. Auto-refresh heartbeat: writes a timestamp to chrome.storage.local
 *    whenever tabs change. main.js listens to chrome.storage.onChanged
 *    and re-renders the dashboard — this works even when the newtab page
 *    is not the active tab.
 */

function isRealTab(url) {
  return (
    url && !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('about:') &&
    !url.startsWith('edge://') &&
    !url.startsWith('brave://')
  )
}

async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({})
    const count = tabs.filter(t => isRealTab(t.url)).length

    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
    if (count === 0) return

    const color = count <= 10 ? '#3aaa6e'   // Fresh mint — in control
               : count <= 20 ? '#d4912a'  // Amber — getting busy
               : '#c4605a'                  // Rose — time to cull

    await chrome.action.setBadgeBackgroundColor({ color })
  } catch {
    chrome.action.setBadgeText({ text: '' })
  }
}

// ── Auto-refresh heartbeat ──────────────────────────────────
// Writes a timestamp to storage; main.js watches this key.
async function touchHeartbeat() {
  try {
    await chrome.storage.local.set({ lastTabChange: Date.now() })
  } catch {}
}

// ── Events ───────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => { updateBadge() })
chrome.runtime.onStartup.addListener(() => { updateBadge() })

chrome.tabs.onCreated.addListener(() => {
  updateBadge()
  touchHeartbeat()
})

chrome.tabs.onRemoved.addListener(() => {
  updateBadge()
  touchHeartbeat()
})

chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
  // Touch on meaningful URL/title changes
  if (changeInfo.url || changeInfo.title) {
    updateBadge()
    touchHeartbeat()
  }
})

// ── Initial ─────────────────────────────────────────────────
updateBadge()
touchHeartbeat()
