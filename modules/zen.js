/**
 * zen.js — Zen Mode (Minimalist/Immersive Mode)
 * Press Z or click the clock area to enter, ESC to exit.
 */

import { t, getLang } from './i18n.js'

let _active = false
let _onKeydown = null

function getWeekday(lang) {
  const weekdays = {
    zh: ['日', '一', '二', '三', '四', '五', '六'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  }
  return weekdays[lang] || weekdays.zh
}

function getMonthName(lang, month) {
  const months = {
    zh: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  }
  return (months[lang] || months.zh)[month]
}

function formatZenDate(lang) {
  const now = new Date()
  const day = now.getDate()
  const month = getMonthName(lang, now.getMonth())
  const year = now.getFullYear()
  const weekday = getWeekday(lang)[now.getDay()]

  if (lang === 'en') {
    return `${weekday}, ${month} ${day}, ${year}`
  }
  return `${year}年${month}${day}日 星期${weekday}`
}

function tickZenClock() {
  const el = document.getElementById('zenClock')
  if (!el) return

  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')

  el.innerHTML = `
    <span class="zen-clock-h">${h}</span>
    <span class="zen-clock-sep">:</span>
    <span class="zen-clock-m">${m}</span>
    <span class="zen-clock-s">${s}</span>
  `
}

function showZenOverlay() {
  const lang = getLang() || 'zh'

  // Create overlay if not exists
  let overlay = document.getElementById('zenOverlay')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'zenOverlay'
    overlay.className = 'zen-overlay'
    overlay.innerHTML = `
      <div class="zen-time-wrap">
        <div class="zen-clock" id="zenClock"></div>
        <div class="zen-date" id="zenDate"></div>
      </div>
      <div class="zen-hint" id="zenHint">
        ${lang === 'en' ? 'Press ESC or click anywhere to exit' : '按 ESC 或点击屏幕任意位置退出'}
      </div>
    `
    document.body.appendChild(overlay)

    // Click overlay to exit
    overlay.addEventListener('click', () => exitZen())
  }

  // Update date text
  const zenDate = document.getElementById('zenDate')
  if (zenDate) zenDate.textContent = formatZenDate(lang)

  // Start clock
  tickZenClock()
  const timer = setInterval(tickZenClock, 1000)
  overlay.dataset.timer = timer

  // Show
  overlay.classList.add('zen-active')

  // Update hint language on language switch
  const hint = document.getElementById('zenHint')
  if (hint) {
    hint.textContent = lang === 'en' ? 'Press ESC or click anywhere to exit' : '按 ESC 或点击屏幕任意位置退出'
  }
}

function hideZenOverlay() {
  const overlay = document.getElementById('zenOverlay')
  if (!overlay) return

  // Stop timer
  const timerId = parseInt(overlay.dataset.timer)
  if (timerId) clearInterval(timerId)

  overlay.classList.remove('zen-active')
}

function enterZen() {
  if (_active) return
  _active = true

  // Hide main UI
  document.getElementById('app')?.classList.add('zen-hidden')

  // Show overlay
  showZenOverlay()

  // Lock body scroll
  document.body.style.overflow = 'hidden'
}

function exitZen() {
  if (!_active) return
  _active = false

  // Show main UI
  document.getElementById('app')?.classList.remove('zen-hidden')

  // Hide overlay
  hideZenOverlay()

  // Unlock body scroll
  document.body.style.overflow = ''
}

function handleKeydown(e) {
  // Ignore if typing in an input field (except ESC)
  const tag = document.activeElement?.tagName
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SEARCH'

  // ESC — exit zen mode (always works)
  if (e.key === 'Escape' && _active) {
    exitZen()
    return
  }

  // Z key — toggle zen mode (only when not typing)
  if ((e.key === 'z' || e.key === 'Z') && !isTyping) {
    if (!_active) {
      enterZen()
    }
  }
}

export function initZen() {
  // Listen for keyboard
  document.addEventListener('keydown', handleKeydown)

  // Clock area dblclick — enter zen mode (not single click, to avoid conflict)
  const clockWrap = document.querySelector('.clock-wrap')
  if (clockWrap) {
    clockWrap.style.cursor = 'pointer'
    clockWrap.setAttribute('title', '双击进入极简模式 | 按 Z 键')
    clockWrap.addEventListener('dblclick', (e) => {
      e.preventDefault()
      enterZen()
    })
  }
}

export function isZenActive() {
  return _active
}

export { enterZen, exitZen }
