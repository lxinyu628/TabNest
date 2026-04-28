/**
 * links.js — Quick Links (bookmark) CRUD
 * Data model: { id, url, title, favicon, order }
 */

const QUICK_LINKS_KEY = 'quickLinks'
const MAX_LINKS = 24

// ── Read ───────────────────────────────────────────────────────────────────

export async function getQuickLinks() {
  const { [QUICK_LINKS_KEY]: list = [] } = await chrome.storage.local.get(QUICK_LINKS_KEY)
  return [...list].sort((a, b) => a.order - b.order)
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function addQuickLink(url, title) {
  const { [QUICK_LINKS_KEY]: list = [] } = await chrome.storage.local.get(QUICK_LINKS_KEY)
  const cleanUrl = url.startsWith('http') ? url : 'https://' + url
  const domain   = extractDomain(cleanUrl)
  const entry = {
    id:      Date.now().toString(),
    url:     cleanUrl,
    title:   title || domain || cleanUrl,
    favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    order:   list.length,
  }
  const updated = [...list, entry].slice(0, MAX_LINKS)
  await chrome.storage.local.set({ [QUICK_LINKS_KEY]: updated })
  return entry
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updateQuickLink(id, changes) {
  const { [QUICK_LINKS_KEY]: list = [] } = await chrome.storage.local.get(QUICK_LINKS_KEY)
  const idx = list.findIndex(l => l.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...changes }
  await chrome.storage.local.set({ [QUICK_LINKS_KEY]: list })
  return list[idx]
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteQuickLink(id) {
  const { [QUICK_LINKS_KEY]: list = [] } = await chrome.storage.local.get(QUICK_LINKS_KEY)
  const filtered = list.filter(l => l.id !== id)
  filtered.forEach((l, i) => { l.order = i })
  await chrome.storage.local.set({ [QUICK_LINKS_KEY]: filtered })
}

// ── Reorder ────────────────────────────────────────────────────────────────

export async function reorderQuickLinks(orderedIds) {
  const { [QUICK_LINKS_KEY]: list = [] } = await chrome.storage.local.get(QUICK_LINKS_KEY)
  const map = new Map(list.map(l => [l.id, l]))
  const reordered = orderedIds
    .filter(id => map.has(id))
    .map((id, i) => { const l = map.get(id); l.order = i; return l })
  await chrome.storage.local.set({ [QUICK_LINKS_KEY]: reordered })
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractDomain(url) {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
