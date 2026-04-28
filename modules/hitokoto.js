/**
 * hitokoto.js — Random quote display using Hitokoto API
 * Falls back gracefully when API is unavailable.
 * Note: Uses chrome.storage.local (not localStorage) for Chrome extension compatibility.
 */

import { t, getLang } from './i18n.js'

// Hitokoto API - 随机获取一言（诗词/名言/文学）
const HITOKOTO_API = 'https://v1.hitokoto.cn/?c=f&encode=json'
const HITOKOTO_KEY = 'organizetab-hitokoto'
const HITOKOTO_INTERVAL    = 10 * 60 * 1000  // 10 minutes — auto-refresh interval
const HITOKOTO_CACHE_TTL   = 30 * 60 * 1000  // 30 minutes — reuse cached quote across tab opens

let _timer = null
let _currentText = ''
let _currentAuthor = ''

async function fetchHitokoto() {
  try {
    const res = await fetch(HITOKOTO_API)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    return {
      text: data.hitokoto || '',
      author: data.from || '',
      id: data.id,
    }
  } catch (err) {
    console.warn('[tabnest] Hitokoto fetch failed:', err)
    return null
  }
}

function saveToCache(data) {
  chrome.storage.local.set({ [HITOKOTO_KEY]: {
    ...data,
    time: Date.now(),
  } }).catch(err => {
    console.warn('[tabnest] Hitokoto cache save failed:', err)
  })
}

function getCached() {
  // This is called synchronously from render(), so we do a one-time read
  // We use a shared variable to avoid async issues
  return _cachedHitokoto
}

let _cachedHitokoto = null

async function loadCache() {
  try {
    const result = await chrome.storage.local.get(HITOKOTO_KEY)
    _cachedHitokoto = result[HITOKOTO_KEY] || null
  } catch {
    _cachedHitokoto = null
  }
}

function render(text, author) {
  const container = document.getElementById('hitokotoWidget')
  if (!container) return

  _currentText = text
  _currentAuthor = author

  if (!text) {
    container.style.display = 'none'
    return
  }

  const authorHtml = author
    ? `<span class="hitokoto-author">—— ${author}</span>`
    : ''

  container.innerHTML = `
    <blockquote class="hitokoto-text" id="hitokotoText">${text}</blockquote>
    ${authorHtml}
  `
  container.style.display = 'flex'
}

async function refresh() {
  const data = await fetchHitokoto()
  if (data) {
    saveToCache(data)
    _cachedHitokoto = { ...data, time: Date.now() }
    render(data.text, data.author)
  }
}

export async function initHitokoto() {
  const container = document.getElementById('hitokotoWidget')
  if (!container) return

  // Load cache from chrome.storage.local
  await loadCache()

  // Listen for language changes — hide/show hitokoto based on language
  // IMPORTANT: register listener unconditionally (before any early return)
  document.addEventListener('tabnest-lang-change', (e) => {
    const newLang = e.detail?.lang || getLang()
    if (newLang === 'en') {
      // Hide hitokoto in English mode
      container.style.display = 'none'
      // Stop auto-refresh timer to save bandwidth
      if (_timer) {
        clearInterval(_timer)
        _timer = null
      }
    } else {
      // Switch back to Chinese — show and (re)start refresh cycle
      if (_cachedHitokoto && _cachedHitokoto.text) {
        render(_cachedHitokoto.text, _cachedHitokoto.author)
      } else {
        refresh()
      }
      // Restart auto-refresh timer if not running
      if (!_timer) {
        _timer = setInterval(refresh, HITOKOTO_INTERVAL)
      }
    }
  })

  // Hide hitokoto when in English mode (initial load)
  const lang = getLang()
  if (lang === 'en') {
    container.style.display = 'none'
    return
  }

  const cached = _cachedHitokoto
  if (cached && cached.text) {
    render(cached.text, cached.author)
    // Refresh if cache is older than 30 minutes
    if (Date.now() - cached.time > HITOKOTO_CACHE_TTL) {
      refresh()
    }
  } else {
    // No cache, fetch immediately
    await refresh()
  }

  // Auto-refresh every 10 minutes
  _timer = setInterval(refresh, HITOKOTO_INTERVAL)
}

export function destroyHitokoto() {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
}

// Manual refresh
export async function refreshHitokoto() {
  await refresh()
}
