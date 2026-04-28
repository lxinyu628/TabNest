/**
 * search.js — Multi-engine search bar
 *
 * Features:
 * - Built-in engines: Google, Bing, Baidu, DuckDuckGo, GitHub
 * - Custom engines: User can add, remove, and set default
 * - Search history persisted in chrome.storage.local
 * - Clicking engine icon to switch doesn't lose focus on search input
 * - Respects searchHistoryEnabled and searchSuggestionsEnabled settings
 */

import { isSearchHistoryEnabled, isSearchSuggestionsEnabled } from './settings.js'

// ── Storage Keys ────────────────────────────────────────────────────────────
const SEARCH_ENGINE_KEY   = 'organizetab-search-engine'
const SEARCH_HISTORY_KEY  = 'organizetab-search-history'
const CUSTOM_ENGINES_KEY  = 'organizetab-custom-engines'
const MAX_HISTORY         = 8

// ── Built-in Engines ────────────────────────────────────────────────────────
const BUILTIN_ENGINES = [
  {
    id:      'google',
    name:    'Google',
    url:     'https://www.google.com/search?q={q}',
    favicon: 'https://www.google.com/favicon.ico',
    color:   '#4285F4',
  },
  {
    id:      'bing',
    name:    'Bing',
    url:     'https://www.bing.com/search?q={q}',
    favicon: 'https://www.bing.com/favicon.ico',
    color:   '#008373',
  },
  {
    id:      'baidu',
    name:    '百度',
    url:     'https://www.baidu.com/s?wd={q}',
    favicon: 'https://www.baidu.com/favicon.ico',
    color:   '#2932E1',
  },
  {
    id:      'duckduckgo',
    name:    'DuckDuckGo',
    url:     'https://duckduckgo.com/?q={q}',
    favicon: 'https://duckduckgo.com/favicon.ico',
    color:   '#DE5833',
  },
  {
    id:      'github',
    name:    'GitHub',
    url:     'https://github.com/search?q={q}',
    favicon: 'https://github.com/favicon.ico',
    color:   '#24292F',
  },
]

// ── State ────────────────────────────────────────────────────────────────────
let _cachedEngineId   = 'google'
let _cachedHistory    = []
let _customEngines    = []  // [{ id, name, url, favicon, color }]
let _allEngines       = []  // merged built-in + custom
let _isPickerOpen     = false
let _clickingEngineBtn = false  // Flag: processing engineBtn click
let _openingPicker    = false   // Flag: prevent focus event from showing history
let _suggestAbort     = null    // AbortController for suggestion fetch
let _lastSuggestions  = []      // Last shown suggestions for restore on refocus
let _lastQuery        = ''      // Last query for suggestions

// ── Init ─────────────────────────────────────────────────────────────────────
export async function initSearch() {
  await loadSearchSettings()
  renderAllEngines()
  initPicker()
  initModal()
  initInputEvents()
}

// ── Engine Management ────────────────────────────────────────────────────────

function getAllEngines() {
  return _allEngines
}

function getCurrentEngine() {
  return _allEngines.find(e => e.id === _cachedEngineId) || _allEngines[0]
}

function renderAllEngines() {
  _allEngines = [...BUILTIN_ENGINES, ..._customEngines]
}

async function loadSearchSettings() {
  try {
    const result = await chrome.storage.local.get([
      SEARCH_ENGINE_KEY,
      SEARCH_HISTORY_KEY,
      CUSTOM_ENGINES_KEY,
    ])
    _cachedEngineId  = result[SEARCH_ENGINE_KEY] || 'google'
    _cachedHistory   = JSON.parse(result[SEARCH_HISTORY_KEY] || '[]')
    _customEngines   = JSON.parse(result[CUSTOM_ENGINES_KEY] || '[]')
  } catch {
    _cachedEngineId  = 'google'
    _cachedHistory   = []
    _customEngines   = []
  }
  renderAllEngines()
}

async function setEngine(id) {
  _cachedEngineId = id
  try {
    await chrome.storage.local.set({ [SEARCH_ENGINE_KEY]: id })
  } catch {}
}

async function saveCustomEngines() {
  try {
    await chrome.storage.local.set({
      [CUSTOM_ENGINES_KEY]: JSON.stringify(_customEngines),
    })
  } catch {}
}

async function addCustomEngine(engine) {
  const id = 'custom_' + Date.now()
  const newEngine = {
    id,
    name:    engine.name.trim(),
    url:     engine.url.trim(),
    favicon: engine.favicon?.trim() || '',
    color:   engine.color?.trim() || '#666666',
  }
  _customEngines.push(newEngine)
  await saveCustomEngines()
  renderAllEngines()
  return newEngine
}

async function removeCustomEngine(id) {
  _customEngines = _customEngines.filter(e => e.id !== id)
  await saveCustomEngines()
  renderAllEngines()
  // If removed engine was current, switch to Google
  if (_cachedEngineId === id) {
    await setEngine('google')
  }
}

function isBuiltinEngine(id) {
  return BUILTIN_ENGINES.some(e => e.id === id)
}

function isCustomEngine(id) {
  return _customEngines.some(e => e.id === id)
}

// ── Search History ───────────────────────────────────────────────────────────

function getHistory() {
  return _cachedHistory
}

async function addToHistory(query) {
  if (!query.trim()) return
  _cachedHistory = _cachedHistory.filter(h => h !== query)
  _cachedHistory.unshift(query)
  _cachedHistory = _cachedHistory.slice(0, MAX_HISTORY)
  try {
    await chrome.storage.local.set({ [SEARCH_HISTORY_KEY]: JSON.stringify(_cachedHistory) })
  } catch {}
}

async function clearHistory() {
  _cachedHistory = []
  try {
    await chrome.storage.local.remove(SEARCH_HISTORY_KEY)
  } catch {}
}

async function removeHistoryItem(query) {
  _cachedHistory = _cachedHistory.filter(h => h !== query)
  try {
    if (_cachedHistory.length === 0) {
      await chrome.storage.local.remove(SEARCH_HISTORY_KEY)
    } else {
      await chrome.storage.local.set({ [SEARCH_HISTORY_KEY]: JSON.stringify(_cachedHistory) })
    }
  } catch {}
}

// ── Search ──────────────────────────────────────────────────────────────────

function doSearch(query, engine) {
  addToHistory(query)
  const url = engine.url.replace('{q}', encodeURIComponent(query.trim()))
  window.open(url, '_blank')
}

// ── Engine Picker UI ─────────────────────────────────────────────────────────

function buildFaviconHTML(engine, size = 14) {
  if (engine.favicon) {
    return `<img data-engine-favicon="${engine.favicon}" src="${engine.favicon}" alt="" style="width:${size}px;height:${size}px;border-radius:2px">`
  }
  return `<span style="width:${size}px;height:${size}px;border-radius:2px;background:${engine.color};display:inline-flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700;">${engine.name.charAt(0).toUpperCase()}</span>`
}

function initPicker() {
  const picker = document.getElementById('enginePicker')
  const engineBtn = document.getElementById('engineBtn')
  const input = document.getElementById('searchInput')

  if (!picker || !engineBtn || !input) return

  // Update engine button display
  updateEngineButton()

  // ── Engine Button: mousedown ─────────────────────────────────────────────
  // We need to handle the click BEFORE the document click listener
  // So we use mousedown which fires before click
  engineBtn.addEventListener('mousedown', (e) => {
    e.preventDefault() // Prevent input blur
    _clickingEngineBtn = true

    // First: close search suggestions/history dropdown
    const suggestions = document.getElementById('searchSuggestions')
    if (suggestions) suggestions.style.display = 'none'

    if (_isPickerOpen) {
      // Picker is open → close it
      _isPickerOpen = false
      picker.style.display = 'none'
      // If input is no longer focused, remove search-focused class
      if (document.activeElement !== input) {
        document.body.classList.remove('search-focused')
      }
    } else {
      // Picker is closed → open it
      // Mark that we're opening picker to prevent focus event from showing history
      _openingPicker = true
      _openPicker()
    }

    // Reset flag after a delay (document click will check this)
    setTimeout(() => { _clickingEngineBtn = false; _openingPicker = false }, 500)
  })

  // ── Engine Button: click ────────────────────────────────────────────────
  // Prevent default click behavior
  engineBtn.addEventListener('click', (e) => {
    e.preventDefault()
    // Focus back to input if it lost focus
    input.focus()
  })

  // ── Document: click ─────────────────────────────────────────────────────
  // Handle ALL clicks in one place for consistency
  document.addEventListener('click', (e) => {
    if (!_isPickerOpen) return

    // If we just clicked the engine button, don't close
    // (the mousedown handler already toggled the state)
    if (_clickingEngineBtn) return

    // Don't close if clicking inside picker
    if (picker.contains(e.target)) return

    // Close picker
    _isPickerOpen = false
    picker.style.display = 'none'

    // If input is no longer focused, remove search-focused class
    if (document.activeElement !== input) {
      document.body.classList.remove('search-focused')
      const hist = document.getElementById('searchSuggestions')
      if (hist) hist.style.display = 'none'
    }
  })

  // ── Internal Functions ───────────────────────────────────────────────────
  function _openPicker() {
    // Build picker content
    _buildEnginePickerContent()

    // Position picker below engine button
    const rect = engineBtn.getBoundingClientRect()
    picker.style.top    = (rect.bottom + window.scrollY + 6) + 'px'
    picker.style.left   = (rect.left + window.scrollX) + 'px'
    picker.style.right  = 'auto'

    // Show picker
    picker.style.display = 'block'
    _isPickerOpen = true
  }

  // Expose for other functions
  window._searchClosePicker = () => {
    _isPickerOpen = false
    if (picker) picker.style.display = 'none'
  }
}

function _buildEnginePickerContent() {
  const picker = document.getElementById('enginePicker')
  if (!picker) return

  const currentEngine = getCurrentEngine()
  const engines = getAllEngines()

  let html = engines.map((e) => `
    <div class="engine-option${e.id === currentEngine.id ? ' active' : ''}" data-engine="${e.id}">
      ${buildFaviconHTML(e)}
      <span class="engine-name">${e.name}</span>
      ${e.id === currentEngine.id ? '<span class="engine-check">✓</span>' : ''}
      ${isBuiltinEngine(e.id) ? '' : '<button class="engine-delete" data-delete="' + e.id + '" title="删除">×</button>'}
    </div>
  `).join('')

  // Add "Add engine" button at the bottom
  html += `
    <div class="engine-option engine-add-btn" id="addEngineBtn">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>添加搜索引擎</span>
    </div>
  `

  picker.innerHTML = html

  // Attach favicon error handlers (fallback to color badge)
  picker.querySelectorAll('img[data-engine-favicon]').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none'
      const badge = img.nextElementSibling
      if (badge && badge.tagName === 'SPAN') {
        badge.style.display = 'inline-flex'
      }
    })
  })

  // ── Bind Picker Events (using event delegation) ────────────────────────
  picker.onclick = async (e) => {
    // Mark that we're clicking inside picker (document click will see this)
    _clickingEngineBtn = true
    setTimeout(() => { _clickingEngineBtn = false }, 500)

    // Click on delete button
    const deleteBtn = e.target.closest('.engine-delete')
    if (deleteBtn) {
      const id = deleteBtn.dataset.delete
      await removeCustomEngine(id)
      updateEngineButton()
      _buildEnginePickerContent()
      input.focus()
      return
    }

    // Click on add engine button
    if (e.target.closest('#addEngineBtn')) {
      window._searchClosePicker?.()
      openAddEngineModal()
      return
    }

    // Click on engine option
    const option = e.target.closest('.engine-option')
    if (option && !option.classList.contains('engine-add-btn')) {
      const id = option.dataset.engine
      await setEngine(id)
      updateEngineButton()
      _buildEnginePickerContent()
      input.focus()
    }
  }
}

function rebuildPicker() {
  _buildEnginePickerContent()
}

function closePicker() {
  const picker = document.getElementById('enginePicker')
  if (picker) picker.style.display = 'none'
  _isPickerOpen = false
}

function updateEngineButton() {
  const btn = document.getElementById('engineBtn')
  const input = document.getElementById('searchInput')
  const engine = getCurrentEngine()
  if (!btn) return

  btn.innerHTML = buildFaviconHTML(engine, 16)
  btn.title = engine.name
  if (input) input.style.setProperty('--engine-color', engine.color)
  
  // Attach favicon error handler (fallback to color badge)
  const faviconImg = btn.querySelector('img[data-engine-favicon]')
  if (faviconImg) {
    faviconImg.addEventListener('error', () => {
      faviconImg.style.display = 'none'
      const badge = btn.querySelector('span')
      if (badge) badge.style.display = 'inline-flex'
    })
  }
}

// ── Add Engine Modal ─────────────────────────────────────────────────────────

function initModal() {
  const modal    = document.getElementById('engineModal')
  const form      = document.getElementById('engineForm')
  const closeBtn  = document.getElementById('engineModalClose')
  const cancelBtn = document.getElementById('engineModalCancel')

  if (!modal || !form) return

  closeBtn?.addEventListener('click', closeAddEngineModal)
  cancelBtn?.addEventListener('click', closeAddEngineModal)
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeAddEngineModal()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name    = document.getElementById('engineNameInput')?.value?.trim()
    const url      = document.getElementById('engineUrlInput')?.value?.trim()
    const favicon  = document.getElementById('engineFaviconInput')?.value?.trim()
    const color    = document.getElementById('engineColorInput')?.value?.trim() || '#666666'

    if (!name || !url) return

    // Validate URL has {q} placeholder
    if (!url.includes('{q}')) {
      alert('URL 中必须包含 {q} 作为搜索词占位符，例如：https://example.com/search?q={q}')
      return
    }

    await addCustomEngine({ name, url, favicon, color })
    closeAddEngineModal()
    updateEngineButton()
    rebuildPicker()
    document.getElementById('searchInput')?.focus()
  })
}

function openAddEngineModal() {
  const modal = document.getElementById('engineModal')
  if (!modal) return

  document.body.classList.add('modal-open')
  // Reset form
  document.getElementById('engineForm')?.reset()
  modal.style.display = 'flex'
  document.getElementById('engineNameInput')?.focus()
}

function closeAddEngineModal() {
  const modal = document.getElementById('engineModal')
  if (modal) {
    document.body.classList.remove('modal-open')
    modal.style.display = 'none'
  }
}

// ── Input Events ─────────────────────────────────────────────────────────────

function initInputEvents() {
  const form   = document.getElementById('searchForm')
  const input  = document.getElementById('searchInput')

  if (!form || !input) return

  // Focus → show history or restore suggestions, add body class
  input.addEventListener('focus', () => {
    document.body.classList.add('search-focused')

    // Skip showing history/suggestions if we're opening the engine picker
    if (_openingPicker) {
      return
    }

    const currentValue = input.value.trim()

    if (currentValue === '') {
      // Empty input → show history only if enabled
      if (isSearchHistoryEnabled()) {
        renderHistory(input)
      }
    } else if (_lastSuggestions.length > 0 && currentValue === _lastQuery) {
      // Has previous suggestions and query matches → restore them (only if enabled)
      if (isSearchSuggestionsEnabled()) {
        renderSuggestions(_lastSuggestions, _lastQuery)
      }
    }
    // If there's input but no saved suggestions, let input event handle it
  })

  // Blur → hide history after delay (unless clicking engineBtn or picker)
  input.addEventListener('blur', () => {
    // Delay blur hide so focus event (which fires before blur) can cancel it
    setTimeout(() => {
      // Skip if blur was triggered by clicking engineBtn/picker (we handle focus manually)
      if (_clickingEngineBtn) return

      // Only skip hiding if input is still focused (focus event didn't fire)
      // This handles the case where blur fires, then immediately focus fires
      // We use a flag that gets reset by focus
      if (document.activeElement === input) return

      const hist = document.getElementById('searchSuggestions')
      if (hist) hist.style.display = 'none'
      document.body.classList.remove('search-focused')
    }, 200)
  })

  // Input change → show suggestions or history
  let _suggestDebounce = null

  // Detect native search clear button click: event.detail === 0 on mousedown
  // This fires BEFORE blur, so we can show history before the blur handler hides the dropdown
  let _skipNextInputHistory = false
  input.addEventListener('mousedown', (e) => {
    if (e.detail === 0) {
      // Native clear button click: clear + show history in one go, stay focused
      _skipNextInputHistory = true
      setTimeout(() => { _skipNextInputHistory = false }, 100)
      input.value = ''
      const hist = document.getElementById('searchSuggestions')
      if (hist) {
        if (isSearchHistoryEnabled()) {
          hist.style.display = 'none'
          renderHistory(input)
        } else {
          hist.style.display = 'none'
        }
      }
    }
  })

  input.addEventListener('input', () => {
    const hist = document.getElementById('searchSuggestions')
    if (!hist) return

    if (input.value.trim() === '') {
      // Show history when input is empty (only if enabled)
      // Skip if the history was already shown by the clear-button mousedown handler
      if (_skipNextInputHistory) return
      hist.style.display = 'none'
      if (isSearchHistoryEnabled()) {
        renderHistory(input)
      }
    } else {
      // Hide history, show suggestions (only if enabled)
      hist.style.display = 'none'
      if (isSearchSuggestionsEnabled()) {
        // Debounce suggestion fetch
        clearTimeout(_suggestDebounce)
        _suggestDebounce = setTimeout(() => {
          fetchSuggestions(input.value.trim())
        }, 250)
      }
    }
  })

  // Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const q = input.value.trim()
    if (q) doSearch(q, getCurrentEngine())
  })

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // "/" focuses search
    if (e.key === '/' &&
        document.activeElement !== input &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault()
      input.focus()
      input.select()
    }

    // Alt+1-5 switch engines (only when not in input)
    if (e.altKey && e.key >= '1' && e.key <= '5' && document.activeElement !== input) {
      e.preventDefault()
      const engines = getAllEngines()
      const idx = parseInt(e.key) - 1
      if (engines[idx]) {
        setEngine(engines[idx].id)
        updateEngineButton()
      }
    }

    // Arrow keys navigation in suggestions/history
    if (document.activeElement === input) {
      const container = document.getElementById('searchSuggestions')
      if (!container || container.style.display !== 'block') return

      const items = container.querySelectorAll('.search-suggestion-item, .search-history-item')
      if (items.length === 0) return

      // Find current highlighted index
      let currentIdx = -1
      items.forEach((item, i) => {
        if (item.classList.contains('active')) currentIdx = i
      })

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (currentIdx < items.length - 1) {
          items.forEach(item => item.classList.remove('active'))
          items[currentIdx + 1].classList.add('active')
          items[currentIdx + 1].scrollIntoView({ block: 'nearest' })
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (currentIdx > 0) {
          items.forEach(item => item.classList.remove('active'))
          items[currentIdx - 1].classList.add('active')
          items[currentIdx - 1].scrollIntoView({ block: 'nearest' })
        }
      } else if (e.key === 'Enter' && currentIdx >= 0) {
        e.preventDefault()
        const query = items[currentIdx].dataset.query
        input.value = query
        hideSuggestions()
        doSearch(query, getCurrentEngine())
      } else if (e.key === 'Escape') {
        hideSuggestions()
        input.blur()
      }
    }
  })
}

// ── Search Suggestions ──────────────────────────────────────────────────────

async function fetchSuggestions(query) {
  if (!query || query.length < 2) {
    hideSuggestions()
    return
  }

  // Cancel previous request
  if (_suggestAbort) {
    _suggestAbort.abort()
  }
  _suggestAbort = new AbortController()

  const signal = _suggestAbort.signal

  try {
    let suggestions = []

    // Try Google suggestions API first
    try {
      const googleResponse = await fetch(
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`,
        { signal }
      )
      if (googleResponse.ok) {
        const data = await googleResponse.json()
        // Google returns [query, [suggestions], ...]
        if (Array.isArray(data) && Array.isArray(data[1])) {
          suggestions = data[1].slice(0, 8)
        }
      }
    } catch (e) {
      console.warn('Google suggestions failed:', e)
    }

    // Fallback to DuckDuckGo if Google fails or returns nothing
    if (suggestions.length === 0) {
      try {
        const ddgResponse = await fetch(
          `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`,
          { signal }
        )
        if (ddgResponse.ok) {
          const data = await ddgResponse.json()
          if (Array.isArray(data)) {
            suggestions = data.map(item => item.phrase || item).slice(0, 8)
          }
        }
      } catch (e) {
        console.warn('DuckDuckGo suggestions failed:', e)
      }
    }

    if (suggestions.length > 0) {
      renderSuggestions(suggestions, query)
    } else {
      hideSuggestions()
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Failed to fetch suggestions:', err)
    }
    hideSuggestions()
  }
}

function renderSuggestions(suggestions, query) {
  const container = document.getElementById('searchSuggestions')
  if (!container) return

  const input = document.getElementById('searchInput')
  const card = document.querySelector('.search-card')
  if (!input || !card) return

  // Save for restore on refocus
  _lastSuggestions = suggestions
  _lastQuery = query

  // Position container below search card
  const rect = card.getBoundingClientRect()
  container.style.top = (rect.bottom + window.scrollY + 8) + 'px'
  container.style.left = (rect.left + window.scrollX) + 'px'
  container.style.right = 'auto'
  container.style.width = rect.width + 'px'

  container.innerHTML = suggestions.map((s, i) => `
    <div class="search-suggestion-item" data-query="${s}" data-index="${i}">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <span>${highlightMatch(s, query)}</span>
    </div>
  `).join('')

  container.style.display = 'block'

  // Click suggestion
  container.querySelectorAll('.search-suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const queryText = item.dataset.query
      input.value = queryText
      hideSuggestions()
      doSearch(queryText, getCurrentEngine())
    })
  })
}

function highlightMatch(text, query) {
  // Highlight the matching part
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    text.slice(0, idx) +
    '<strong>' + text.slice(idx, idx + query.length) + '</strong>' +
    text.slice(idx + query.length)
  )
}

function hideSuggestions() {
  const container = document.getElementById('searchSuggestions')
  if (container) {
    container.innerHTML = ''
    container.style.display = 'none'
  }
}

// ── History UI ───────────────────────────────────────────────────────────────

function renderHistory(inputEl) {
  const container = document.getElementById('searchSuggestions')
  const card = document.querySelector('.search-card')
  if (!container || !inputEl || !card) return

  // Position container below search card
  const rect = card.getBoundingClientRect()
  container.style.top = (rect.bottom + window.scrollY + 8) + 'px'
  container.style.left = (rect.left + window.scrollX) + 'px'
  container.style.right = 'auto'
  container.style.width = rect.width + 'px'

  const history = getHistory()
  if (history.length === 0) {
    container.innerHTML = ''
    container.style.display = 'none'
    return
  }

  container.innerHTML = `
    ${history.map(h => `
      <div class="search-history-item" data-query="${h}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <span>${h}</span>
        <button class="history-delete-btn" data-delete-query="${h}" title="删除此条记录">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `).join('')}
    <div class="search-history-clear">
      <button id="clearHistoryBtn">清除历史</button>
    </div>
  `
  container.style.display = 'block'

  // Click history item
  container.querySelectorAll('.search-history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // If clicking delete button, don't trigger search
      if (e.target.closest('.history-delete-btn')) return
      const query = item.dataset.query
      inputEl.value = query
      container.style.display = 'none'
      doSearch(query, getCurrentEngine())
    })
  })

  // Delete single history item
  // Prevent mousedown from blurring the search input so dropdown stays open
  container.querySelectorAll('.history-delete-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const query = btn.dataset.deleteQuery
      await removeHistoryItem(query)
      // Re-render: if no history left, hide; otherwise refresh list
      if (_cachedHistory.length === 0) {
        container.innerHTML = ''
        container.style.display = 'none'
      } else {
        renderHistory(inputEl)
      }
    })
  })

  // Clear history
  const clearBtn = document.getElementById('clearHistoryBtn')
  clearBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    clearHistory()
    container.style.display = 'none'
  })
}

// ── Expose for external refresh ──────────────────────────────────────────────
export function refreshEngines() {
  renderAllEngines()
  updateEngineButton()
}
