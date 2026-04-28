/**
 * events.js — Event delegation handlers
 */

import { showToast, shootConfetti, playCloseSound } from './ui.js'
import { t, getLang } from './i18n.js'
import {
  closeTabsByExactUrl,
  closeDuplicateTabs,
  closeSelfDupes,
  focusTab,
  fetchOpenTabs,
  getOpenTabs,
  getRealTabs,
  reopenTab,
} from './tabs.js'
import { setupFaviconFallbacks } from './render.js'
import {
  saveTabForLater,
  checkOffSavedTab,
  dismissSavedTab,
  getSavedTabs,
  getRecentlyClosed,
  removeRecentlyClosed,
} from './storage.js'
import { getDomainGroups, renderDeferredColumn, renderArchiveItem, timeAgo } from './render.js'

// ── Confirmation Modal ─────────────────────────────────────────────────
let _confirmResolve = null

function createConfirmModal() {
  let modal = document.getElementById('confirmModal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'confirmModal'
    modal.className = 'confirm-modal'
    modal.innerHTML = `
      <div class="confirm-backdrop"></div>
      <div class="confirm-dialog">
        <div class="confirm-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div class="confirm-title" id="confirmTitle"></div>
        <div class="confirm-body" id="confirmBody"></div>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-cancel" id="confirmCancel">${t('confirm.cancel')}</button>
          <button class="confirm-btn confirm-ok" id="confirmOk">${t('confirm.ok')}</button>
        </div>
      </div>`
    document.body.appendChild(modal)

    // Backdrop click = cancel
    modal.querySelector('.confirm-backdrop').addEventListener('click', () => dismissConfirmModal(false))
    document.getElementById('confirmCancel').addEventListener('click', () => dismissConfirmModal(false))
    document.getElementById('confirmOk').addEventListener('click', () => dismissConfirmModal(true))
  }
  return modal
}

export function dismissConfirmModal(result = false) {
  const modal = document.getElementById('confirmModal')
  if (modal) {
    document.body.classList.remove('modal-open')
    modal.style.display = 'none'
  }
  if (_confirmResolve) {
    _confirmResolve(result)
    _confirmResolve = null
  }
}

/**
 * Show a confirmation dialog.
 * @param {string} title
 * @param {string} body
 * @returns {Promise<boolean>} true = confirmed, false = cancelled
 */
export function showConfirm(title, body) {
  return new Promise((resolve) => {
    _confirmResolve = resolve
    const modal = createConfirmModal()
    document.getElementById('confirmTitle').textContent = title
    document.getElementById('confirmBody').textContent = body
    // Update button labels in case language changed
    const cancelBtn = document.getElementById('confirmCancel')
    const okBtn = document.getElementById('confirmOk')
    if (cancelBtn) cancelBtn.textContent = t('confirm.cancel')
    if (okBtn) okBtn.textContent = t('confirm.ok')
    document.body.classList.add('modal-open')
    modal.style.display = 'flex'
  })
}

// ── Card close animation ──────────────────────────────────────────────
function animateCardOut(card) {
  if (!card) return
  const rect = card.getBoundingClientRect()
  shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2)
  card.classList.add('closing')
  setTimeout(() => {
    card.remove()
    checkEmptyState()
  }, 300)
}

function checkEmptyState() {
  const grid = document.getElementById('openTabsMissions')
  if (!grid) return
  const remaining = grid.querySelectorAll('.domain-card:not(.closing)').length
  if (remaining > 0) return
  grid.innerHTML = `
    <div class="missions-empty-state">
      <div class="empty-checkmark">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <div class="empty-title">${t('empty.domain')}</div>
    </div>`
}

// ── Recently Closed Panel ──────────────────────────────────────────────
async function renderRecentlyClosed() {
  const section = document.getElementById('recentlyClosedSection')
  const list = document.getElementById('recentlyClosedList')
  const countEl = document.getElementById('recentlyClosedCount')
  if (!section || !list) return

  const tabs = await getRecentlyClosed()
  if (!tabs.length) {
    section.style.display = 'none'
    return
  }

  section.style.display = 'block'
  if (countEl) countEl.textContent = `(${tabs.length})`
  list.innerHTML = tabs.map(tab => {
    const ago = timeAgo(tab.closedAt)
    const safeTitle = (tab.title || tab.url || '').replace(/"/g, '&quot;')
    const safeUrl = (tab.url || '').replace(/"/g, '&quot;')
    let domain = ''
    try { domain = new URL(tab.url).hostname } catch {}
    // Prefer Chrome's stored favicon URL; fall back to multi-source helper
    const favHtml = tab.favicon && tab.favicon.startsWith('http')
      ? `<img src="${tab.favicon}" alt="" style="width:13px;height:13px;vertical-align:-2px"
            data-fb1="https://www.google.com/s2/favicons?domain=${domain}&sz=16"
            data-fb2="https://icons.duckduckgo.com/ip3/${domain}.ico"
            data-fb3="https://logo.clearbit.com/${domain}?size=16">`
      : (domain ? `<span style="display:inline-block;width:13px;height:13px;background:var(--chip-bg,#e8f0ea);border-radius:3px;vertical-align:-2px"></span>` : '')
    return `
      <div class="recently-item" data-recently-id="${tab.id}">
        <span class="recently-favicon">${favHtml}</span>
        <a href="#" class="recently-title" data-action="reopen-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${safeTitle}">${tab.title || tab.url}</a>
        <span class="recently-time">${ago}</span>
        <button class="recently-remove" data-action="remove-recently" data-recently-id="${tab.id}" title="Remove">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>`
  }).join('')
  
  // Attach favicon fallback handlers
  if (typeof setupFaviconFallbacks === 'function') {
    setupFaviconFallbacks(list)
  }
}

// ── Main click handler ─────────────────────────────────────────────────
export function initEvents() {
  document.addEventListener('click', async (e) => {
    const actionEl = e.target.closest('[data-action]')
    if (!actionEl) return

    const action = actionEl.dataset.action

    // ── Reopen recently closed tab ───────────────────────────────
    if (action === 'reopen-tab') {
      const url = actionEl.dataset.tabUrl
      const title = actionEl.dataset.tabTitle || url
      if (!url) return
      await reopenTab({ url, title })
      showToast(t('toast.tabReopened'))
      const item = actionEl.closest('.recently-item')
      const id = item?.dataset?.recentlyId
      if (id) await removeRecentlyClosed(id)
      await renderRecentlyClosed()
      return
    }

    // ── Remove from recently closed ─────────────────────────────
    if (action === 'remove-recently') {
      const id = actionEl.dataset.recentlyId
      if (id) await removeRecentlyClosed(id)
      const item = actionEl.closest('.recently-item')
      if (item) {
        item.style.transition = 'opacity 0.2s'
        item.style.opacity = '0'
        setTimeout(() => { item.remove(); renderRecentlyClosed() }, 200)
      }
      return
    }

    // ── Toggle recently closed section ──────────────────────────
    if (action === 'toggle-recently-closed') {
      const section = document.getElementById('recentlyClosedSection')
      if (section) section.style.display = section.style.display === 'none' ? 'block' : 'none'
      return
    }

    // ── Close extra TabNest tabs ───────────────────────────
    if (action === 'close-self-dupes') {
      const all = await chrome.tabs.query({})
      const extId = chrome.runtime.id
      const newtabUrl = `chrome-extension://${extId}/index.html`
      const selfTabs = all.filter(t => t.url === newtabUrl || t.url === 'chrome://newtab/')
      const toClose = selfTabs.slice(1)
      if (!toClose.length) return

      const confirmed = await showConfirm(
        t('confirm.title'),
        t('confirm.closeSelfDupes', { n: toClose.length })
      )
      if (!confirmed) return

      await closeSelfDupes()
      playCloseSound()
      const banner = document.getElementById('selfDupeBanner')
      if (banner) {
        banner.style.transition = 'opacity 0.4s'
        banner.style.opacity = '0'
        setTimeout(() => { banner.style.display = 'none'; banner.style.opacity = '1' }, 400)
      }
      showToast(t('toast.closedSelfDupes'))
      return
    }

    const card = actionEl.closest('.domain-card')

    // ── Expand overflow chips ───────────────────────────────────
    if (action === 'expand-chips') {
      const overflow = actionEl.parentElement.querySelector('.page-chips-overflow')
      if (overflow) {
        overflow.style.display = 'contents'
        actionEl.remove()
      }
      return
    }

    // ── Focus a tab ────────────────────────────────────────────
    if (action === 'focus-tab') {
      const tabUrl = actionEl.dataset.tabUrl
      if (tabUrl) await focusTab(tabUrl)
      return
    }

    // ── Close single tab ──────────────────────────────────────
    if (action === 'close-single-tab') {
      e.stopPropagation()
      const tabUrl = actionEl.dataset.tabUrl
      if (!tabUrl) return

      const confirmed = await showConfirm(
        t('confirm.title'),
        t('confirm.closeSingle')
      )
      if (!confirmed) return

      const all = await chrome.tabs.query({})
      const match = all.find(t => t.url === tabUrl)
      if (match) await chrome.tabs.remove(match.id)
      await fetchOpenTabs()
      playCloseSound()

      const chip = actionEl.closest('.page-chip')
      if (chip) {
        const rect = chip.getBoundingClientRect()
        shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2)
        chip.style.transition = 'opacity 0.2s, transform 0.2s'
        chip.style.opacity    = '0'
        chip.style.transform  = 'scale(0.85)'
        setTimeout(() => {
          chip.remove()
          document.querySelectorAll('.domain-card').forEach(c => {
            const chips = c.querySelectorAll('.page-chip[data-action="focus-tab"]')
            if (chips.length === 0) animateCardOut(c)
          })
        }, 200)
      }

      const statTabs = document.getElementById('statTabs')
      if (statTabs) statTabs.textContent = getOpenTabs().length
      showToast(t('toast.closedTab'))
      await renderRecentlyClosed()
      return
    }

    // ── Save single tab for later ──────────────────────────────
    if (action === 'defer-single-tab') {
      e.stopPropagation()
      const tabUrl   = actionEl.dataset.tabUrl
      const tabTitle = actionEl.dataset.tabTitle || tabUrl
      if (!tabUrl) return

      try {
        await saveTabForLater({ url: tabUrl, title: tabTitle })
      } catch {
        showToast(t('toast.saveFailed'))
        return
      }

      const all = await chrome.tabs.query({})
      const match = all.find(t => t.url === tabUrl)
      if (match) await chrome.tabs.remove(match.id)
      await fetchOpenTabs()

      const chip = actionEl.closest('.page-chip')
      if (chip) {
        chip.style.transition = 'opacity 0.2s, transform 0.2s'
        chip.style.opacity = '0'
        chip.style.transform = 'scale(0.85)'
        setTimeout(() => chip.remove(), 200)
      }

      await renderDeferredColumn()
      showToast(t('toast.savedTab'))
      return
    }

    // ── Check off saved tab ────────────────────────────────────
    if (action === 'check-deferred') {
      const id = actionEl.dataset.deferredId
      if (!id) return
      await checkOffSavedTab(id)

      const item = actionEl.closest('.deferred-item')
      if (item) {
        item.classList.add('checked')
        setTimeout(() => {
          item.classList.add('removing')
          setTimeout(async () => {
            item.remove()
            await renderDeferredColumn()
          }, 300)
        }, 700)
      }
      return
    }

    // ── Dismiss saved tab ──────────────────────────────────────
    if (action === 'dismiss-deferred') {
      const id = actionEl.dataset.deferredId
      if (!id) return
      await dismissSavedTab(id)

      const item = actionEl.closest('.deferred-item')
      if (item) {
        item.classList.add('removing')
        setTimeout(async () => {
          item.remove()
          await renderDeferredColumn()
        }, 300)
      }
      return
    }

    // ── Close all tabs in a domain ────────────────────────────
    if (action === 'close-domain-tabs') {
      const domainId = actionEl.dataset.domainId
      const groups = getDomainGroups()
      // stableId = 'domain-' + domain.replace(...), compare directly
      const group = groups.find(g =>
        'domain-' + g.domain.replace(/[^a-z0-9]/g, '-') === domainId
      )
      if (!group) return

      const label = group.domain === '__landing-pages__'
        ? t('group.homepages')
        : (group.label || group.domain)
      const urls = group.tabs.map(t => t.url)
      const confirmed = await showConfirm(
        t('confirm.title'),
        t('confirm.closeGroup', { count: urls.length, label })
      )
      if (!confirmed) return

      await closeTabsByExactUrl(urls)
      playCloseSound()
      if (card) animateCardOut(card)

      const idx = groups.indexOf(group)
      if (idx !== -1) groups.splice(idx, 1)

      showToast(t('toast.closedGroup', { n: urls.length }))
      await renderRecentlyClosed()

      const statTabs = document.getElementById('statTabs')
      if (statTabs) statTabs.textContent = getOpenTabs().length
      return
    }

    // ── Dedup: keep one of each ────────────────────────────────
    if (action === 'dedup-keep-one') {
      const urlsEncoded = actionEl.dataset.dupeUrls || ''
      const urls = urlsEncoded.split(',').map(u => decodeURIComponent(u)).filter(Boolean)
      if (!urls.length) return

      const all = getOpenTabs()
      let count = 0
      for (const url of urls) count += all.filter(t => t.url === url).length
      count -= urls.length

      const confirmed = await showConfirm(
        t('confirm.title'),
        t('confirm.closeDupes', { n: count })
      )
      if (!confirmed) return

      await closeDuplicateTabs(urls, true)
      playCloseSound()

      actionEl.style.transition = 'opacity 0.2s'
      actionEl.style.opacity    = '0'
      setTimeout(() => actionEl.remove(), 200)

      if (card) {
        card.querySelectorAll('.chip-dupe-badge').forEach(b => {
          b.style.transition = 'opacity 0.2s'; b.style.opacity = '0'
          setTimeout(() => b.remove(), 200)
        })
        card.querySelectorAll('.open-tabs-badge').forEach(b => {
          const text = b.textContent || ''
          if (text.includes('duplicate') || text.includes('重复')) {
            b.style.transition = 'opacity 0.2s'; b.style.opacity = '0'
            setTimeout(() => b.remove(), 200)
          }
        })
        card.classList.remove('has-dupes')
        card.classList.add('has-normal')
      }

      showToast(t('toast.dupClosed'))
      await renderRecentlyClosed()
      return
    }

    // ── Close ALL tabs ─────────────────────────────────────────
    if (action === 'close-all-open-tabs') {
      const allUrls = getRealTabs().map(t => t.url)
      if (!allUrls.length) return

      const confirmed = await showConfirm(
        t('confirm.title'),
        t('confirm.closeAll', { n: allUrls.length })
      )
      if (!confirmed) return

      await closeTabsByExactUrl(allUrls)
      playCloseSound()

      document.querySelectorAll('#openTabsMissions .domain-card').forEach(c => {
        shootConfetti(
          c.getBoundingClientRect().left + c.offsetWidth / 2,
          c.getBoundingClientRect().top  + c.offsetHeight / 2,
        )
        animateCardOut(c)
      })

      showToast(t('toast.freshStart'))
      await renderRecentlyClosed()
      return
    }
  })

  // ── Archive toggle ──────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('#archiveToggle')
    if (!toggle) return
    toggle.classList.toggle('open')
    const body = document.getElementById('archiveBody')
    if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none'
  })

  // ── Archive search ──────────────────────────────────────────────
  document.addEventListener('input', async (e) => {
    if (e.target.id !== 'archiveSearch') return
    const q = e.target.value.trim().toLowerCase()
    const archiveList = document.getElementById('archiveList')
    if (!archiveList) return

    try {
      const { archived } = await getSavedTabs()
      if (q.length < 2) {
        archiveList.innerHTML = archived.map(renderArchiveItem).join('')
        return
      }
      const results = archived.filter(item =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.url   || '').toLowerCase().includes(q)
      )
      archiveList.innerHTML = results.map(renderArchiveItem).join('')
        || `<div style="font-size:11px;color:var(--muted);padding:8px 0">${t('archive.noResults')}</div>`
    } catch (err) {
      console.warn('[tabnest] Archive search failed:', err)
    }
  })
}

// ── Public: init recently closed panel ───────────────────────────────
export async function initRecentlyClosed() {
  await renderRecentlyClosed()
}