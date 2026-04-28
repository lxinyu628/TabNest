/**
 * wallpaper.js — Wallpaper management system
 * Supports: gradient backgrounds, custom image upload, Unsplash random wallpapers
 * Uses IndexedDB for large images and chrome.storage.local for metadata.
 */

import { showToast } from './ui.js'

const WALLPAPER_KEY = 'organizetab-wallpaper'
const IDB_NAME = 'organizetab-wallpaper-db'
const IDB_STORE = 'wallpapers'
const IDB_VERSION = 1

// Gradient presets
const GRADIENTS = [
  { id: 'default',  name: '默认', colors: ['#b8d4c4', '#a8ccbc', '#c0d0c4'] },
  { id: 'mint',     name: '薄荷', colors: ['#a8d8c8', '#98c8b8', '#a8d0c0'] },
  { id: 'sunset',  name: '日落', colors: ['#e8c8b0', '#d8b8a0', '#e0c8b8'] },
  { id: 'ocean',   name: '海洋', colors: ['#a8c8d0', '#98b8c0', '#a0c0c8'] },
  { id: 'lavender',name: '薰衣草', colors: ['#c0b8d0', '#b0a8c0', '#b8b0c8'] },
  { id: 'peach',   name: '蜜桃', colors: ['#e8d8c8', '#d8c8b8', '#e0d0c0'] },
  { id: 'sage',    name: '鼠尾草', colors: ['#b0c0b0', '#a0b0a0', '#b0c0b0'] },
]

let currentWallpaper = {
  type: 'gradient', // 'gradient' | 'image' | 'random'
  value: 'default',
}

let randomWallpaperUrl = ''
let currentObjectUrl = null // For cleanup

// ── IndexedDB for Large Images ─────────────────────────────────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' })
      }
    }
  })
}

async function saveImageToIDB(blob) {
  const db = await openIDB()
  const id = 'custom-wallpaper'

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const request = store.put({ id, blob, timestamp: Date.now() })

    request.onsuccess = () => resolve(id)
    request.onerror = () => reject(request.error)
  })
}

async function loadImageFromIDB(id) {
  const db = await openIDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const store = tx.objectStore(IDB_STORE)
    const request = store.get(id)

    request.onsuccess = () => {
      const result = request.result
      if (result && result.blob) {
        // Create object URL for the blob
        const objectUrl = URL.createObjectURL(result.blob)
        resolve(objectUrl)
      } else {
        resolve(null)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

async function deleteImageFromIDB(id) {
  const db = await openIDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ── Cleanup Object URLs ────────────────────────────────────────────────────────

function revokeCurrentObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

// ── Storage (chrome.storage.local + IndexedDB) ────────────────────────────────

async function loadWallpaper() {
  try {
    const result = await chrome.storage.local.get(WALLPAPER_KEY)
    if (result[WALLPAPER_KEY]) {
      const saved = result[WALLPAPER_KEY]
      // Validate saved data has required properties
      if (saved && typeof saved.type === 'string' && saved.value) {
        currentWallpaper = saved
        console.log('[tabnest] Wallpaper loaded:', saved.type)

        // For image type with IDB reference, load from IndexedDB
        if (saved.type === 'image' && saved.idbId) {
          try {
            const objectUrl = await loadImageFromIDB(saved.idbId)
            if (objectUrl) {
              currentWallpaper.resolvedUrl = objectUrl
              currentObjectUrl = objectUrl
              console.log('[tabnest] Image loaded from IndexedDB')
            }
          } catch (err) {
            console.warn('[tabnest] Failed to load image from IndexedDB:', err)
          }
        }
      }
    }
  } catch (err) {
    console.warn('[tabnest] Failed to load wallpaper:', err)
  }
  return currentWallpaper
}

async function saveWallpaper() {
  // Validate data before saving
  if (!currentWallpaper || !currentWallpaper.type) {
    console.warn('[tabnest] Invalid wallpaper data, skip saving')
    return false
  }

  // For image type with IndexedDB, don't store the blob in chrome.storage
  const toSave = {
    type: currentWallpaper.type,
    value: currentWallpaper.type === 'image' ? currentWallpaper.value : currentWallpaper.value,
    idbId: currentWallpaper.idbId || null,
  }

  try {
    await chrome.storage.local.set({ [WALLPAPER_KEY]: toSave })
    console.log('[tabnest] Wallpaper saved:', currentWallpaper.type)
    return true
  } catch (err) {
    console.warn('[tabnest] Failed to save wallpaper:', err)
    showToast('壁纸保存失败')
    return false
  }
}

function getWallpaperElement() {
  return document.getElementById('wallpaperLayer')
}

function getWallpaperImage() {
  return document.getElementById('wallpaperImage')
}

// ── Apply wallpaper ────────────────────────────────────────────────────────────

function applyWallpaper(wp) {
  const layer = getWallpaperElement()
  const img = getWallpaperImage()

  if (!layer) return

  // Remove all gradient data attributes
  GRADIENTS.forEach(g => layer.removeAttribute(`data-gradient-${g.id}`))
  layer.removeAttribute('data-gradient')

  if (wp.type === 'gradient') {
    layer.setAttribute('data-gradient', wp.value)
    img.style.display = 'none'
    img.src = ''
  } else if (wp.type === 'image') {
    // Use resolved URL if available, otherwise fall back to data URL
    const src = wp.resolvedUrl || wp.value
    img.src = src
    img.style.display = 'block'
  } else if (wp.type === 'random') {
    img.src = wp.value
    img.style.display = 'block'
  }

  // Mark wallpaper as ready to show gradient background
  layer.classList.add('ready')
}

// ── Gradient grid ──────────────────────────────────────────────────────────────

function renderGradientGrid() {
  const grid = document.getElementById('gradientGrid')
  if (!grid) return

  grid.innerHTML = GRADIENTS.map(g => `
    <div class="gradient-swatch ${currentWallpaper.type === 'gradient' && currentWallpaper.value === g.id ? 'active' : ''}"
         data-gradient="${g.id}"
         style="background: linear-gradient(135deg, ${g.colors[0]} 0%, ${g.colors[1]} 50%, ${g.colors[2]} 100%)"
         title="${g.name}">
    </div>
  `).join('')

  // Click handlers
  grid.querySelectorAll('.gradient-swatch').forEach(el => {
    el.addEventListener('click', () => {
      const gradientId = el.getAttribute('data-gradient')
      currentWallpaper = { type: 'gradient', value: gradientId }
      saveWallpaper()
      applyWallpaper(currentWallpaper)
      renderGradientGrid()
      showToast('壁纸已更新')
    })
  })
}

// ── Random wallpaper (Multiple free sources) ─────────────────────────────────

// Free wallpaper APIs (sorted by reliability in China)
const RANDOM_WALLPAPER_SOURCES = [
  // 1. Bing Daily (most reliable, no CORS issues usually)
  () => fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1')
    .then(r => r.ok ? r.json() : null)
    .then(data => data?.images?.[0]?.url ? 'https://www.bing.com' + data.images[0].url : null)
    .catch(() => null),

  // 2. Picsum (fallback)
  () => Promise.resolve(`https://picsum.photos/seed/${Date.now()}/1920/1080`),

  // 3. Lorem Flickr
  () => Promise.resolve(`https://loremflickr.com/1920/1080/nature?lock=${Date.now()}`),

  // 4. Unsplash Source (deprecated but sometimes still works)
  () => Promise.resolve(`https://source.unsplash.com/1920x1080/?nature,landscape&sig=${Date.now()}`),
]

let currentSourceIndex = 0

async function fetchRandomWallpaper() {
  // Try each source in order until one works
  for (let i = 0; i < RANDOM_WALLPAPER_SOURCES.length; i++) {
    const index = (currentSourceIndex + i) % RANDOM_WALLPAPER_SOURCES.length
    try {
      const url = await RANDOM_WALLPAPER_SOURCES[index]()
      if (url) {
        currentSourceIndex = (index + 1) % RANDOM_WALLPAPER_SOURCES.length
        console.log(`[tabnest] Wallpaper source ${index + 1} works: ${url.substring(0, 60)}...`)
        return url
      }
    } catch (err) {
      console.warn(`[tabnest] Wallpaper source ${index + 1} failed:`, err.message)
    }
  }

  // Ultimate fallback: solid gradient placeholder
  console.warn('[tabnest] All wallpaper sources failed, using gradient fallback')
  return null
}

async function loadRandomWallpaper() {
  const preview = document.getElementById('wallpaperRandomPreview')
  const img = document.getElementById('randomWallpaperImg')
  const btn = document.getElementById('wallpaperRandomBtn')

  if (btn) {
    btn.disabled = true
    btn.innerHTML = `
      <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>获取中…</span>
    `
  }

  try {
    const url = await fetchRandomWallpaper()
    if (url) {
      randomWallpaperUrl = url
      if (img) {
        img.src = url
        preview.style.display = 'block'
      }
    } else {
      if (preview) preview.style.display = 'none'
      showToast('网络不可用，请使用渐变壁纸')
    }
  } catch (err) {
    console.error('[tabnest] Failed to load random wallpaper:', err)
  }

  if (btn) {
    btn.disabled = false
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
      </svg>
      <span>换一换</span>
    `
  }
}

// ── Image upload ──────────────────────────────────────────────────────────────

function setupImageUpload() {
  const uploadArea = document.getElementById('imageUploadArea')
  const fileInput = document.getElementById('wallpaperFileInput')
  const clearBtn = document.getElementById('wallpaperClearBtn')

  if (!uploadArea || !fileInput) return

  uploadArea.addEventListener('click', () => fileInput.click())

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault()
    uploadArea.style.borderColor = 'var(--accent)'
    uploadArea.style.background = 'var(--accent-light)'
  })

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = ''
    uploadArea.style.background = ''
  })

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault()
    uploadArea.style.borderColor = ''
    uploadArea.style.background = ''

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file).catch(err => {
        console.warn('[tabnest] Image upload error:', err)
      })
    } else if (file) {
      showToast('请上传图片文件')
    }
  })

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0]
    if (file) {
      handleImageFile(file).catch(err => {
        console.warn('[tabnest] Image upload error:', err)
      })
    }
  })

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      // Clear IndexedDB
      await deleteImageFromIDB('custom-wallpaper').catch(console.warn)
      revokeCurrentObjectUrl()

      currentWallpaper = { type: 'gradient', value: 'default' }
      applyWallpaper(currentWallpaper)
      clearBtn.style.display = 'none'
      await saveWallpaper()
      showToast('已清除自定义壁纸')
    })
  }
}

// Threshold for using IndexedDB instead of data URL (5MB)
const IDB_THRESHOLD = 5 * 1024 * 1024

async function handleImageFile(file) {
  showToast('正在处理图片...')

  try {
    let imageUrl

    if (file.size > IDB_THRESHOLD) {
      // Large image: use IndexedDB for storage
      console.log('[tabnest] Large image detected, using IndexedDB storage')

      const idbId = await saveImageToIDB(file)
      imageUrl = await loadImageFromIDB(idbId)

      if (!imageUrl) {
        throw new Error('Failed to load from IndexedDB')
      }

      // Clean up previous object URL
      revokeCurrentObjectUrl()

      currentWallpaper = {
        type: 'image',
        value: `indexeddb:${idbId}`, // Reference stored in chrome.storage
        idbId: idbId,
        resolvedUrl: imageUrl,
      }
      currentObjectUrl = imageUrl

      // Save metadata to chrome.storage.local (not the blob)
      await saveWallpaper()
      console.log('[tabnest] Large image saved to IndexedDB')
    } else {
      // Small image: use traditional data URL for simplicity
      const dataUrl = await readFileAsDataURL(file)
      currentWallpaper = { type: 'image', value: dataUrl }
      imageUrl = dataUrl
      await saveWallpaper()
      console.log('[tabnest] Small image saved as data URL')
    }

    // Apply wallpaper
    applyWallpaper(currentWallpaper)

    // Show clear button
    const clearBtn = document.getElementById('wallpaperClearBtn')
    if (clearBtn) clearBtn.style.display = 'block'

    // Update wallpaper modal preview
    const preview = document.getElementById('wallpaperRandomPreview')
    const img = document.getElementById('randomWallpaperImg')
    if (preview && img) {
      img.src = imageUrl
      preview.style.display = 'block'
    }

    showToast('壁纸已更新')
  } catch (err) {
    console.error('[tabnest] Image processing failed:', err)
    showToast('图片处理失败')
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

// ── Panel switching (inside settings) ────────────────────────────────────────

function showSettingsWallpaperPanel(type) {
  const gradientPanel = document.getElementById('settingsGradientPanel')
  const imagePanel    = document.getElementById('settingsImagePanel')
  const randomPanel   = document.getElementById('settingsRandomPanel')

  if (gradientPanel) gradientPanel.style.display = type === 'gradient' ? 'block' : 'none'
  if (imagePanel)    imagePanel.style.display    = type === 'image'    ? 'block' : 'none'
  if (randomPanel)   randomPanel.style.display   = type === 'random'   ? 'block' : 'none'

  document.querySelectorAll('.settings-wallpaper-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-type') === type)
  })
}

// Show current saved random wallpaper (if exists) without loading new one
function showCurrentRandomWallpaper() {
  const preview = document.getElementById('wallpaperRandomPreview')
  const img     = document.getElementById('randomWallpaperImg')

  if (currentWallpaper.type === 'random' && currentWallpaper.value) {
    if (img) img.src = currentWallpaper.value
    if (preview) preview.style.display = 'block'
    randomWallpaperUrl = currentWallpaper.value
  } else if (currentWallpaper.type === 'image') {
    const src = currentWallpaper.resolvedUrl || currentWallpaper.value
    if (img && src) {
      img.src = src
      if (preview) preview.style.display = 'block'
    }
  } else {
    if (img) {
      img.src = 'data:image/svg+xml,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" fill="none">
          <rect width="400" height="225" fill="#e8f4ed"/>
          <text x="50%" y="45%" text-anchor="middle" fill="#999" font-size="14">点击下方按钮获取新壁纸</text>
          <text x="50%" y="55%" text-anchor="middle" fill="#bbb" font-size="12">或拖拽图片到上传区域</text>
        </svg>
      `)
    }
    if (preview) preview.style.display = 'block'
    randomWallpaperUrl = ''
  }
}

// Called each time the Appearance panel becomes visible
function initSettingsWallpaperPanel() {
  renderGradientGrid()
  showCurrentRandomWallpaper()
  setupImageUpload()

  // Show/hide clear button
  const clearBtn = document.getElementById('wallpaperClearBtn')
  if (clearBtn) {
    clearBtn.style.display = currentWallpaper.type === 'image' ? 'block' : 'none'
  }

  // Set initial active tab
  showSettingsWallpaperPanel(currentWallpaper.type || 'gradient')

  // Bind tab click (idempotent - use data flag)
  const tabContainer = document.querySelector('.settings-wallpaper-tabs')
  if (tabContainer && !tabContainer._wallpaperBound) {
    tabContainer._wallpaperBound = true
    tabContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.settings-wallpaper-tab')
      if (tab) showSettingsWallpaperPanel(tab.dataset.type)
    })
  }

  // Random wallpaper button
  const randomBtn = document.getElementById('wallpaperRandomBtn')
  if (randomBtn && !randomBtn._wallpaperBound) {
    randomBtn._wallpaperBound = true
    randomBtn.addEventListener('click', async () => {
      await loadRandomWallpaper()
    })
  }

  // Apply random wallpaper on preview click
  const randomPreview = document.getElementById('wallpaperRandomPreview')
  if (randomPreview && !randomPreview._wallpaperBound) {
    randomPreview._wallpaperBound = true
    randomPreview.addEventListener('click', applyRandomWallpaper)
  }
}

// ── Apply random wallpaper ────────────────────────────────────────────────────

function applyRandomWallpaper() {
  if (!randomWallpaperUrl) {
    showToast('请先加载随机壁纸')
    return
  }

  currentWallpaper = { type: 'random', value: randomWallpaperUrl }
  saveWallpaper()
  applyWallpaper(currentWallpaper)
  showToast('壁纸已更新')
}

// ── Init ─────────────────────────────────────────────────────────────────────

export async function initWallpaper() {
  // Load and apply saved wallpaper
  await loadWallpaper()
  applyWallpaper(currentWallpaper)

  // Listen for settings panel open event
  document.addEventListener('settings:open-wallpaper', () => {
    initSettingsWallpaperPanel()
  })
}

export { applyRandomWallpaper }

