/**
 * ui.js — Sound, particles, toast, and theme management
 */

// ── Swoosh sound (Web Audio API — no external files) ────────
export function playCloseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const t = ctx.currentTime
    const duration = 0.22

    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const pos = i / data.length
      const env = pos < 0.1 ? pos / 0.1 : Math.pow(1 - (pos - 0.1) / 0.9, 1.5)
      data[i] = (Math.random() * 2 - 1) * env
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 2.0
    filter.frequency.setValueAtTime(3800, t)
    filter.frequency.exponentialRampToValueAtTime(350, t + duration)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)

    source.connect(filter).connect(gain).connect(ctx.destination)
    source.start(t)
    setTimeout(() => ctx.close(), 600)
  } catch {}
}

// ── Confetti burst ───────────────────────────────────────────
export function shootConfetti(x, y) {
  const colors = [
    '#3aaa6e', '#6de0a0', '#a8e6cf',   // mint greens
    '#e8835a', '#f5a96a', '#ffc49a',   // soft coral
    '#4dcf8e', '#f5c77e', '#b5e8d0',   // mixed warm
  ]

  const count = 16
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    const isCircle = Math.random() > 0.5
    const size = 4 + Math.random() * 7
    const color = colors[Math.floor(Math.random() * colors.length)]

    el.style.cssText = [
      `position:fixed`,
      `left:${x}px`,
      `top:${y}px`,
      `width:${size}px`,
      `height:${size}px`,
      `background:${color}`,
      `border-radius:${isCircle ? '50%' : '2px'}`,
      `pointer-events:none`,
      `z-index:9999`,
      `transform:translate(-50%,-50%)`,
      `opacity:1`,
    ].join(';')
    document.body.appendChild(el)

    const angle = Math.random() * Math.PI * 2
    const speed = 55 + Math.random() * 110
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed - 70
    const gravity = 180
    const startTime = performance.now()
    const duration = 650 + Math.random() * 200

    function frame(now) {
      const elapsed = (now - startTime) / 1000
      const progress = elapsed / (duration / 1000)
      if (progress >= 1) { el.remove(); return }

      const px = vx * elapsed
      const py = vy * elapsed + 0.5 * gravity * elapsed * elapsed
      const opacity = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2
      const rotate = elapsed * 180 * (isCircle ? 0 : 1)

      el.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) rotate(${rotate}deg)`
      el.style.opacity = opacity
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
}

// ── Toast notification ───────────────────────────────────────
export function showToast(message) {
  const toast = document.getElementById('toast')
  document.getElementById('toastText').textContent = message
  toast.classList.add('visible')
  setTimeout(() => toast.classList.remove('visible'), 2400)
}

// ── Empty state ───────────────────────────────────────────────
import { t } from './i18n.js'

export function showEmptyState(container) {
  if (!container) return
  container.innerHTML = `
    <div class="missions-empty-state">
      <div class="empty-checkmark">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <div class="empty-title">${t('empty.domain')}</div>
    </div>`
}

// ── Theme management ──────────────────────────────────────────
const THEME_KEY = 'organizetab-theme'
let _cachedTheme = null

async function loadThemeFromStorage() {
  try {
    const result = await chrome.storage.local.get(THEME_KEY)
    _cachedTheme = result[THEME_KEY] || null
  } catch {
    _cachedTheme = null
  }
}

function getStoredTheme() {
  return _cachedTheme
}

function applyTheme(theme) {
  // Resolve system theme to actual value for display purposes
  let actualTheme = theme
  if (theme === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  // Fallback to light if invalid
  if (!actualTheme || (actualTheme !== 'light' && actualTheme !== 'dark')) {
    actualTheme = 'light'
  }

  // Set theme on both html and body for maximum compatibility
  document.documentElement.setAttribute('data-theme', actualTheme)
  document.body.setAttribute('data-theme', actualTheme)

  // Update active state on theme menu buttons only (not lang-option buttons)
  document.querySelectorAll('#themeMenu .theme-option').forEach(btn => {
    const btnTheme = btn.dataset.theme
    const isActive = btnTheme === theme || (theme === 'system' && btnTheme === 'system')
    btn.classList.toggle('active', isActive)
  })
}

// Global theme selection handler
window.__selectTheme = async function(theme) {
  const themeMenu = document.getElementById('themeMenu')
  _cachedTheme = theme
  try {
    await chrome.storage.local.set({ [THEME_KEY]: theme })
  } catch {}
  applyTheme(theme)
  if (themeMenu) themeMenu.style.display = 'none'
}

export async function initTheme() {
  await loadThemeFromStorage()
  const stored = getStoredTheme() || 'system'
  applyTheme(stored)

  // Move theme menu to body to avoid any container issues
  const themeMenu = document.getElementById('themeMenu')
  if (themeMenu && themeMenu.parentElement !== document.body) {
    document.body.appendChild(themeMenu)
  }

  // Toggle button shows/hides menu
  const themeBtn = document.getElementById('themeBtn')

  if (themeBtn) {
    themeBtn.onclick = (e) => {
      e.stopPropagation()
      // Blur search input to remove focus overlay that blocks clicks
      const searchInput = document.getElementById('mainSearch')
      if (searchInput) searchInput.blur()
      // Remove search-focused class to restore pointer-events
      document.body.classList.remove('search-focused')

      if (!themeMenu) return
      if (themeMenu.style.display === 'block') {
        themeMenu.style.display = 'none'
      } else {
        // Position menu below button
        const rect = themeBtn.getBoundingClientRect()
        themeMenu.style.top = (rect.bottom + 8) + 'px'
        themeMenu.style.right = (window.innerWidth - rect.right) + 'px'
        themeMenu.style.left = 'auto'
        themeMenu.style.display = 'block'
      }
    }
  }

  // Close on outside click (don't close if clicking inside themeMenu itself)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#themeMenu')) return
    if (themeMenu) themeMenu.style.display = 'none'
  })

  // Theme option selection — only target #themeMenu buttons, NOT lang-option buttons
  const buttons = document.querySelectorAll('#themeMenu .theme-option')
  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const theme = btn.dataset.theme
      if (!theme) return
      await window.__selectTheme(theme)
    })
  })

  // Listen for OS theme changes when on "system"
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') applyTheme('system')
  })
}
