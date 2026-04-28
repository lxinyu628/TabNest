/**
 * clock.js — Real-time clock, date display, and greeting
 */

import { t, getLang } from './i18n.js'

let _clockTimer = null

// Day names for Chinese locale
const ZH_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const EN_MONTHS   = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December']

function formatTime(d) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return { h, m, s }
}

function formatDate(d, lang) {
  const dow = d.getDay()
  const day = d.getDate()
  const mon = d.getMonth()
  const yr  = d.getFullYear()

  if (lang === 'en') {
    return `${EN_WEEKDAYS[dow]}, ${EN_MONTHS[mon]} ${day}, ${yr}`
  }
  return `${yr}年${mon + 1}月${day}日 星期${ZH_WEEKDAYS[dow]}`
}

function getGreeting(lang) {
  const h = new Date().getHours()
  if (h < 6)  return lang === 'en' ? 'Good night'       : t('greeting.evening')
  if (h < 12) return t('greeting.morning')
  if (h < 18) return t('greeting.afternoon')
  return t('greeting.evening')
}

function tick() {
  const now  = new Date()
  const lang = getLang() || 'zh'
  const { h, m, s } = formatTime(now)

  const clockEl   = document.getElementById('clockDisplay')
  const dateEl    = document.getElementById('dateDisplay')
  const greetEl   = document.getElementById('greeting')

  // ── Top-bar clock (left corner) ──────────────────────────
  if (clockEl) {
    clockEl.innerHTML =
      `<span class="clock-h">${h}</span>` +
      `<span class="clock-sep">:</span>` +
      `<span class="clock-m">${m}</span>` +
      `<span class="clock-s">${s}</span>`
  }

  if (dateEl)  dateEl.textContent  = formatDate(now, lang)
  if (greetEl) greetEl.textContent = getGreeting(lang)

  // ── Hero clock + date (above search bar, centered) ─────────
  const heroClockEl = document.getElementById('heroClockDisplay')
  const heroDateEl  = document.getElementById('heroDateDisplay')
  if (heroClockEl) {
    heroClockEl.innerHTML =
      `<span class="hero-clock-h">${h}</span>` +
      `<span class="hero-clock-sep">:</span>` +
      `<span class="hero-clock-m">${m}</span>`
  }
  if (heroDateEl) heroDateEl.textContent = formatDate(now, lang)
}

export function initClock() {
  tick() // immediate first paint
  _clockTimer = setInterval(tick, 1000)
}

export function destroyClock() {
  if (_clockTimer) clearInterval(_clockTimer)
}
