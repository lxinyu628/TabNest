/**
 * render.js — All DOM rendering functions
 */

import { t, getLang } from './i18n.js'
import { friendlyDomain, stripTitleNoise, smartTitle, cleanTitle, groupTabs } from './grouping.js'
import { fetchOpenTabs, getRealTabs, getOpenTabs } from './tabs.js'
import { getSavedTabs } from './storage.js'

// ── Multi-source favicon helper ─────────────────────────────────────────────
// Uses data attributes for fallback URLs, then attaches error handlers via JS.
// This avoids inline onerror handlers that violate CSP.
//
// Usage: generateFaviconHTML(domain) → safe HTML string or empty string
export function generateFaviconHTML(domain, size = 16) {
  if (!domain) return ''
  const safeDomain = domain.replace(/"/g, '')
  const bareDomain = safeDomain.replace(/^www\./, '')
  const fallback1 = `https://icons.duckduckgo.com/ip3/${safeDomain}.ico`
  const fallback2 = `https://${bareDomain}/favicon.ico`
  const fallback3 = `https://logo.clearbit.com/${safeDomain}?size=${size}`
  return `
<img class="chip-favicon" 
     data-src="${safeDomain}"
     data-fb1="${fallback1}"
     data-fb2="${fallback2}"
     data-fb3="${fallback3}"
     src="https://www.google.com/s2/favicons?domain=${safeDomain}&sz=${size}"
     alt="" style="width:${size}px;height:${size}px">`
}

export function generateFaviconImg(domain, size = 16, extraStyle = '') {
  if (!domain) return ''
  const safeDomain = domain.replace(/"/g, '')
  const bareDomain = safeDomain.replace(/^www\./, '')
  const fallback1 = `https://icons.duckduckgo.com/ip3/${safeDomain}.ico`
  const fallback2 = `https://${bareDomain}/favicon.ico`
  const fallback3 = `https://logo.clearbit.com/${safeDomain}?size=${size}`
  return `<img data-src="${safeDomain}"
     data-fb1="${fallback1}"
     data-fb2="${fallback2}"
     data-fb3="${fallback3}"
     src="https://www.google.com/s2/favicons?domain=${safeDomain}&sz=${size}" 
     alt="" style="${extraStyle}">`
}

// ── Favicon fallback handler (called after DOM updates) ──────────────────────
// Attaches error handlers to all favicon images without inline onerror
export function setupFaviconFallbacks(container) {
  if (!container) return
  const imgs = container.querySelectorAll('img[data-fb1]')
  imgs.forEach(img => {
    if (img.dataset.fallbackAttached) return
    img.dataset.fallbackAttached = 'true'
    
    img.addEventListener('error', () => {
      const fb1 = img.dataset.fb1
      const fb2 = img.dataset.fb2
      const fb3 = img.dataset.fb3
      
      if (fb1 && img.src !== fb1) {
        img.src = fb1
      } else if (fb2 && img.src !== fb2) {
        img.src = fb2
      } else if (fb3 && img.src !== fb3) {
        img.src = fb3
      } else {
        img.remove()
      }
    })
  })
}

// ── SVG Icons ────────────────────────────────────────────────
const ICONS = {
  tabs:  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18" /></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`,
}

// ── In-memory state ───────────────────────────────────────────
let domainGroups = []

export function getDomainGroups() { return domainGroups }
export function setDomainGroups(g) { domainGroups = g }

// ── Date/Greeting helpers ─────────────────────────────────────
export function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return t('greeting.morning')
  if (h < 17) return t('greeting.afternoon')
  return t('greeting.evening')
}

export function getDateDisplay() {
  const lang = getLang() || 'zh'
  const locale = lang === 'en' ? 'en-US' : 'zh-CN'
  const fmt = lang === 'en'
    ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
  return new Date().toLocaleDateString(locale, fmt)
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const lang = getLang() || 'zh'
  const then = new Date(dateStr)
  const now  = new Date()
  const diffM  = Math.floor((now - then) / 60000)
  const diffH  = Math.floor((now - then) / 3600000)
  const diffD  = Math.floor((now - then) / 86400000)
  if (lang === 'zh') {
    if (diffM < 1)   return '刚刚'
    if (diffM < 60)  return `${diffM} 分钟前`
    if (diffH < 24)  return `${diffH} 小时前`
    if (diffD === 1) return '昨天'
    return `${diffD} 天前`
  }
  if (diffM < 1)   return 'just now'
  if (diffM < 60)  return `${diffM} min ago`
  if (diffH < 24)  return `${diffH} hr${diffH !== 1 ? 's' : ''} ago`
  if (diffD === 1) return 'yesterday'
  return `${diffD} days ago`
}

// ── Build overflow chips ─────────────────────────────────────
function buildOverflowChips(hiddenTabs, urlCounts) {
  const chips = hiddenTabs.map(tab => {
    const label   = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), '')
    const count   = urlCounts[tab.url] || 1
    const dupeTag = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : ''
    const chipCls = count > 1 ? ' chip-has-dupes' : ''
    const safeUrl = (tab.url || '').replace(/"/g, '&quot;')
    const safeTitle = label.replace(/"/g, '&quot;')
    let domain = ''
    try { domain = new URL(tab.url).hostname } catch {}
    const favHtml = domain ? generateFaviconHTML(domain) : ''
    return `<div class="page-chip clickable${chipCls}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${favHtml}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="Save for later">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="Close">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`
  }).join('')

  const moreLabel = (() => {
    const lang = getLang() || 'zh'
    return lang === 'zh' ? `+${hiddenTabs.length} 个` : `+${hiddenTabs.length} more`
  })()
  return `
    <div class="page-chips-overflow" style="display:none">${chips}</div>
    <div class="page-chip page-chip-overflow clickable" data-action="expand-chips">
      <span class="chip-text">${moreLabel}</span>
    </div>`
}

// ── Domain card ─────────────────────────────────────────────
export function renderDomainCard(group) {
  const tabs     = group.tabs || []
  const isLanding = group.domain === '__landing-pages__'
  const stableId  = 'domain-' + group.domain.replace(/[^a-z0-9]/g, '-')

  const urlCounts = {}
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1
  const dupeEntries = Object.entries(urlCounts).filter(([, c]) => c > 1)
  const hasDupes    = dupeEntries.length > 0
  const totalDupes  = dupeEntries.reduce((s, [, c]) => s + c - 1, 0)

  // Show ALL tabs including duplicates — user may have same URL open
// with different content. Mark duplicates with badge for visual clarity.
  const visibleTabs  = tabs.slice(0, 8)
  const extraCount   = tabs.length - visibleTabs.length

  const pageChips = visibleTabs.map(tab => {
    let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain)
    try {
      const parsed = new URL(tab.url)
      if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`
    } catch {}
    const count    = urlCounts[tab.url]
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : ''
    const chipCls   = count > 1 ? ' chip-has-dupes' : ''
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;')
    const safeTitle = label.replace(/"/g, '&quot;')
    let domain = ''
    try { domain = new URL(tab.url).hostname } catch {}
    const favHtml = domain ? generateFaviconHTML(domain) : ''
    return `<div class="page-chip clickable${chipCls}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${favHtml}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="Save for later">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="Close">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`
  }).join('') + (extraCount > 0 ? buildOverflowChips(tabs.slice(8), urlCounts) : '')

  const badgeClass = hasDupes ? 'open-tabs-badge dupes' : 'open-tabs-badge'
  const cardClass  = hasDupes ? 'domain-card has-dupes' : 'domain-card has-normal'
  const label = isLanding ? t('group.homepages') : (group.label || friendlyDomain(group.domain))

  const closeAllLabel = (() => {
    const lang = getLang() || 'zh'
    if (lang === 'zh') return `关闭 ${tabs.length} 个`
    return `Close ${tabs.length}`
  })()
  let actionsHtml = `
    <button class="action-btn close-all" data-action="close-domain-tabs" data-domain-id="${stableId}">
      ${ICONS.close} ${closeAllLabel}
    </button>`

  if (hasDupes) {
    const dupeUrlsEncoded = dupeEntries.map(([url]) => encodeURIComponent(url)).join(',')
    const dupLabel = (() => {
      const lang = getLang() || 'zh'
      if (lang === 'zh') return `去重 ${totalDupes}`
      return `Dedup ${totalDupes}`
    })()
    actionsHtml += `
      <button class="action-btn" data-action="dedup-keep-one" data-dupe-urls="${dupeUrlsEncoded}">
        ${dupLabel}
      </button>`
  }

  const tabCount = tabs.length
  const dupCount = totalDupes

  return `
    <div class="${cardClass}" data-domain-id="${stableId}">
      <div class="mission-top">
        <div class="mission-header">
          <span class="mission-name">${label}</span>
          <span class="${badgeClass}" title="${tabCount} 个标签">${tabCount}</span>
          ${hasDupes ? `<span class="open-tabs-badge dupes" title="${dupCount} 个重复">${dupCount}</span>` : ''}
        </div>
        <div class="mission-actions">${actionsHtml}</div>
      </div>
      <div class="mission-pages">${pageChips}</div>
    </div>`
}

// ── Deferred list items ──────────────────────────────────────
export function renderDeferredItem(item) {
  let domain = ''
  try { domain = new URL(item.url).hostname.replace(/^www\./, '') } catch {}
  const favHtml = domain ? generateFaviconImg(domain, 13, 'width:13px;height:13px;vertical-align:-2px;margin-right:4px') : ''
  const ago = timeAgo(item.savedAt)
  const safeTitle = (item.title || '').replace(/"/g, '&quot;')

  return `
    <div class="deferred-item" data-deferred-id="${item.id}">
      <input type="checkbox" class="deferred-checkbox" data-action="check-deferred" data-deferred-id="${item.id}">
      <div class="deferred-info">
        <a href="${item.url}" target="_blank" rel="noopener" class="deferred-title" title="${safeTitle}">
          ${favHtml}${item.title || item.url}
        </a>
        <div class="deferred-meta"><span>${domain}</span><span>${ago}</span></div>
      </div>
      <button class="deferred-dismiss" data-action="dismiss-deferred" data-deferred-id="${item.id}" title="Dismiss">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>`
}

export function renderArchiveItem(item) {
  const ago = item.completedAt ? timeAgo(item.completedAt) : timeAgo(item.savedAt)
  const safeTitle = (item.title || '').replace(/"/g, '&quot;')
  return `
    <div class="archive-item">
      <a href="${item.url}" target="_blank" rel="noopener" class="archive-item-title" title="${safeTitle}">${item.title || item.url}</a>
      <span class="archive-item-date">${ago}</span>
    </div>`
}

// ── Deferred column renderer ─────────────────────────────────
export async function renderDeferredColumn() {
  const column      = document.getElementById('deferredColumn')
  const list        = document.getElementById('deferredList')
  const empty       = document.getElementById('deferredEmpty')
  const countEl     = document.getElementById('deferredCount')
  const archiveEl   = document.getElementById('deferredArchive')
  const archCountEl = document.getElementById('archiveCount')
  const archList    = document.getElementById('archiveList')
  if (!column) return

  try {
    const { active, archived } = await getSavedTabs()

    if (!active.length && !archived.length) {
      column.style.display = 'none'
      return
    }

    column.style.display = 'block'

    if (active.length) {
      const itemLabel = (() => {
        const lang = getLang() || 'zh'
        if (lang === 'zh') return `${active.length} 项`
        return `${active.length} item${active.length !== 1 ? 's' : ''}`
      })()
      if (countEl) countEl.textContent = itemLabel
      list.innerHTML = active.map(renderDeferredItem).join('')
      list.style.display = 'block'
      empty.style.display = 'none'
    } else {
      list.style.display = 'none'
      empty.style.display = 'block'
    }

    if (archived.length) {
      const archCountEl = document.getElementById('archiveCount')
      if (archCountEl) archCountEl.textContent = `(${archived.length})`
      archList.innerHTML = archived.map(renderArchiveItem).join('')
      archiveEl.style.display = 'block'
    } else {
      archiveEl.style.display = 'none'
    }
  } catch (err) {
    console.warn('[tabnest] Could not load saved tabs:', err)
    column.style.display = 'none'
  }
}

// ── Main dashboard renderer ─────────────────────────────────
export async function renderDashboard() {
  // Note: greeting & dateDisplay are now managed exclusively by clock.js
  // (updates every second). Do not overwrite them here to avoid flicker.

  // Fetch + group tabs
  await fetchOpenTabs()
  const realTabs = getRealTabs()
  domainGroups = groupTabs(realTabs)

  // Render domain cards
  const section  = document.getElementById('openTabsSection')
  const gridEl  = document.getElementById('openTabsMissions')
  const countEl = document.getElementById('openTabsSectionCount')

  if (domainGroups.length && section) {
    const domainLabel = (() => {
      const lang = getLang() || 'zh'
      if (lang === 'zh') return `${domainGroups.length} 个分组`
      return `${domainGroups.length} domain${domainGroups.length !== 1 ? 's' : ''}`
    })()
    const closeAllLabel = (() => {
      const lang = getLang() || 'zh'
      if (lang === 'zh') return `关闭全部 ${realTabs.length} 个标签`
      return `Close all ${realTabs.length} tabs`
    })()
    countEl.innerHTML = `
      ${domainLabel} &nbsp;&middot;&nbsp;
      <button class="action-btn close-all" data-action="close-all-open-tabs" style="font-size:11px;padding:4px 10px;">
        ${ICONS.close} ${closeAllLabel}
      </button>`
    gridEl.innerHTML = domainGroups.map(renderDomainCard).join('')
    section.style.display = 'block'
  } else if (section) {
    section.style.display = 'none'
  }

  // Footer stats
  const statTabs = document.getElementById('statTabs')
  if (statTabs) statTabs.textContent = getOpenTabs().length

  // TabNest dupe banner
  const allTabs = getOpenTabs()
  const selfTabs = allTabs.filter(t => t.isSelfNewTab)
  const banner = document.getElementById('selfDupeBanner')
  if (banner) {
    if (selfTabs.length > 1) {
      const textEl = banner.querySelector('.banner-text')
      if (textEl) {
        textEl.innerHTML = t('banner.dupe', { n: selfTabs.length })
      }
      banner.style.display = 'flex'
    } else {
      banner.style.display = 'none'
    }
  }

  // Deferred column
  await renderDeferredColumn()
}
