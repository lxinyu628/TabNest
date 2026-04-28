/**
 * bookmarks.js — Quick Links rendering + interaction
 */

import { t, getLang } from './i18n.js'
import { getQuickLinks, addQuickLink, updateQuickLink, deleteQuickLink, reorderQuickLinks } from './links.js'
import { showToast } from './ui.js'
import { showConfirm } from './events.js'
import { setupFaviconFallbacks } from './render.js'

// ── State ──────────────────────────────────────────────────────────────────

let _links = []
let _dragSrcId = null
let _isEditing = false
let _longPressTimer = null
let _hasChanges = false
let _isExpanded = false
let _collapseTimer = null

// ── Public init ────────────────────────────────────────────────────────────

export async function initBookmarks() {
  _links = await getQuickLinks()
  renderLinks()
  bindAddButton()
  bindAddFromCurrentTab()
  bindCornerButton()
  bindModal()
  bindEditToolbar()
  bindLongPress()
  bindCollapse()
}

// ── Corner button (bookmark entry point) ──────────────────────────────────

function bindCornerButton() {
  const btn = document.getElementById('cornerBookmarksBtn')
  if (!btn) return

  btn.addEventListener('click', () => {
    const section = document.getElementById('quickLinksSection')
    if (!section) return

    // If section is hidden, scroll to it
    if (section.style.display === 'none') {
      // Show the section (even if empty, show the add button)
      section.style.display = 'block'
      // Scroll to the section
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Open the add modal after a short delay
      setTimeout(() => openAddModal(), 300)
    } else {
      // Already visible, just open add modal
      openAddModal()
    }
  })
}

// ── Render ─────────────────────────────────────────────────────────────────

export function renderLinks() {
  const section = document.getElementById('quickLinksSection')
  if (!section) return

  const grid = document.getElementById('quickLinksGrid')
  if (!grid) return

  const pill = document.getElementById('qlPillTrigger')

  if (_links.length === 0) {
    grid.innerHTML = ''
    section.style.display = 'none'
    if (pill) pill.style.display = 'none'
    collapseSection()
    return
  }

  section.style.display = 'block'
  if (pill) pill.style.display = 'flex'

  // 默认收起（除非已在编辑模式或已展开状态）
  if (!_isEditing) {
    collapseSection()
  }

  // Update editing mode class
  if (_isEditing) {
    grid.classList.add('ql-editing-mode')
    section.classList.add('ql-editing')
    // 编辑模式下强制展开
    expandSection()
  } else {
    grid.classList.remove('ql-editing-mode')
    section.classList.remove('ql-editing')
  }

  grid.innerHTML = _links.map(link => buildLinkCard(link)).join('') + buildAddCard()

  // Attach favicon fallback handlers
  if (typeof setupFaviconFallbacks === 'function') {
    setupFaviconFallbacks(grid)
  }

  // Click handler: open link (only when not editing)
  grid.querySelectorAll('.ql-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (_isEditing) return // In edit mode, clicks are handled by edit buttons
      if (e.target.closest('.ql-edit-btn') || e.target.closest('.ql-del-btn')) return
      const link = _links.find(l => l.id === card.dataset.id)
      if (link) window.open(link.url, '_blank')
    })
  })

  // Edit button
  grid.querySelectorAll('.ql-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const link = _links.find(l => l.id === btn.closest('.ql-card').dataset.id)
      if (link) openEditModal(link)
    })
  })

  // Delete button - with confirmation
  grid.querySelectorAll('.ql-del-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const card = btn.closest('.ql-card')
      const id = card.dataset.id
      const link = _links.find(l => l.id === id)
      const linkName = escapeHtml(link?.title || link?.url || '')

      const confirmed = await showConfirm(
        t('confirm.deleteConfirm'),
        t('confirm.deleteLink', { name: linkName })
      )

      if (confirmed) {
        await deleteQuickLink(id)
        _links = _links.filter(l => l.id !== id)
        _hasChanges = true
        renderLinks()
        showToast(t('toast.deleted'))
      }
    })
  })

  // 添加卡片点击事件
  const addCard = document.getElementById('qlAddCard')
  if (addCard) {
    addCard.addEventListener('click', () => {
      if (!_isEditing) {
        openAddModal()
      }
    })
  }

  // Drag-and-drop (only when not editing)
  if (!_isEditing) {
    grid.querySelectorAll('.ql-card').forEach(card => {
      card.setAttribute('draggable', 'true')
      card.addEventListener('dragstart', onDragStart)
      card.addEventListener('dragover', onDragOver)
      card.addEventListener('dragleave', onDragLeave)
      card.addEventListener('drop', onDrop)
      card.addEventListener('dragend', onDragEnd)
    })
  }
}

// ── Build HTML ─────────────────────────────────────────────────────────────

function buildLinkCard(link) {
  const lang = getLang()
  const domain = extractDomain(link.url)
  // Multi-source favicon: prefer duckduckgo, then Google's s2 service
  const faviconSrc = `https://icons.duckduckgo.com/ip3/${domain}.ico`
  const fallbackSrc = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  const defaultIcon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`)}`
  return `
  <div class="ql-card" data-id="${link.id}" draggable="true">
    <div class="ql-favicon-wrap">
      <img class="ql-favicon" src="${faviconSrc}" loading="lazy" alt=""
           data-fb1="${fallbackSrc}"
           data-fb2="${defaultIcon}">
    </div>
    <div class="ql-title">${escapeHtml(link.title)}</div>
    <div class="ql-actions">
      <button class="ql-edit-btn" title="${t('ql.edit')}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
        </svg>
      </button>
      <button class="ql-del-btn" title="${t('toast.deleted')}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </button>
    </div>
  </div>`
}

// 添加卡片
function buildAddCard() {
  return `
  <div class="ql-card ql-add-card" id="qlAddCard" title="${t('ql.add')}">
    <div class="ql-add-icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </div>
    <div class="ql-title">${t('ql.add')}</div>
  </div>`
}

// ── Drag & Drop ─────────────────────────────────────────────────────────────

function onDragStart(e) {
  _dragSrcId = e.currentTarget.dataset.id
  e.currentTarget.classList.add('dragging')
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  const card = e.currentTarget
  if (card.dataset.id !== _dragSrcId) {
    card.classList.add('drag-over')
  }
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over')
}

async function onDrop(e) {
  e.preventDefault()
  const card = e.currentTarget
  card.classList.remove('drag-over')
  const targetId = card.dataset.id
  if (targetId === _dragSrcId) return

  // Reorder in memory
  const srcIdx = _links.findIndex(l => l.id === _dragSrcId)
  const tgtIdx = _links.findIndex(l => l.id === targetId)
  const [moved] = _links.splice(srcIdx, 1)
  _links.splice(tgtIdx, 0, moved)

  // Persist
  await reorderQuickLinks(_links.map(l => l.id))
  renderLinks()
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging')
  _dragSrcId = null
}

// ── Add button ─────────────────────────────────────────────────────────────

function bindAddButton() {
  const addBtn = document.getElementById('qlAddBtn')
  if (addBtn) {
    addBtn.addEventListener('click', openAddModal)
  }
}

// ── Add from current tab ───────────────────────────────────────────────────

function bindAddFromCurrentTab() {
  const btn = document.getElementById('qlAddFromTabBtn')
  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab || !tab.url) {
          showToast(t('ql.addCurrentTabError'))
          return
        }

        // Check if URL is valid for bookmarking
        const url = tab.url
        const isValidUrl = url.startsWith('http://') || url.startsWith('https://')
        const isRestricted = url.startsWith('chrome://') ||
                             url.startsWith('chrome-extension://') ||
                             url.startsWith('about:')

        if (!isValidUrl || isRestricted) {
          showToast(t('ql.addCurrentTabRestricted'))
          return
        }

        await addQuickLink(url, tab.title || '')
        _links = await getQuickLinks()
        renderLinks()
        showToast(t('ql.addCurrentTabSuccess'))
      } catch (err) {
        console.error('[organize-tab] add from tab:', err)
        showToast(t('toast.saveFailed'))
      }
    })
  }
}

// ── Modal ──────────────────────────────────────────────────────────────────

function bindModal() {
  const modal = document.getElementById('qlModal')
  const form  = document.getElementById('qlForm')
  const close = document.getElementById('qlModalClose')
  const cancel = document.getElementById('qlModalCancel')

  close?.addEventListener('click', closeModal)
  cancel?.addEventListener('click', closeModal)

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    await handleModalSubmit()
  })
}

function openAddModal() {
  const modal = document.getElementById('qlModal')
  const titleInput = document.getElementById('qlTitleInput')
  const urlInput  = document.getElementById('qlUrlInput')
  const heading   = document.getElementById('qlModalHeading')
  const submitBtn = document.getElementById('qlSubmitBtn')

  heading.textContent = t('ql.add')
  submitBtn.textContent = t('confirm.ok')

  document.getElementById('qlEditId').value = ''
  titleInput.value = ''
  urlInput.value  = ''

  document.body.classList.add('modal-open')
  modal.style.display = 'flex'
  urlInput.focus()
}

let _currentEditId = null

function openEditModal(link) {
  const modal = document.getElementById('qlModal')
  const titleInput = document.getElementById('qlTitleInput')
  const urlInput  = document.getElementById('qlUrlInput')
  const heading   = document.getElementById('qlModalHeading')
  const submitBtn = document.getElementById('qlSubmitBtn')

  heading.textContent = t('ql.edit')
  submitBtn.textContent = t('confirm.ok')

  _currentEditId = link.id
  document.getElementById('qlEditId').value = link.id
  titleInput.value = link.title
  urlInput.value  = link.url

  document.body.classList.add('modal-open')
  modal.style.display = 'flex'
  urlInput.focus()
}

function closeModal() {
  const modal = document.getElementById('qlModal')
  if (modal) {
    document.body.classList.remove('modal-open')
    modal.style.display = 'none'
  }
}

async function handleModalSubmit() {
  const editId  = document.getElementById('qlEditId').value
  const url      = document.getElementById('qlUrlInput').value.trim()
  const title    = document.getElementById('qlTitleInput').value.trim()

  if (!url) return

  if (editId) {
    // Update
    const updated = await updateQuickLink(editId, { url, title })
    const idx = _links.findIndex(l => l.id === editId)
    if (idx !== -1) _links[idx] = updated
    showToast(t('toast.savedTab'))  // reuse existing toast
  } else {
    // Add
    const newLink = await addQuickLink(url, title)
    _links.push(newLink)
    showToast(getLang() === 'zh' ? '已添加' : 'Added')
  }

  closeModal()
  _hasChanges = true
  renderLinks()
}

// ── Edit Mode ─────────────────────────────────────────────────────────────

function enterEditMode() {
  if (_isEditing) return
  _isEditing = true
  _hasChanges = false
  renderLinks()
  showToast(getLang() === 'zh' ? '已进入编辑模式' : 'Edit mode enabled')
}

function exitEditMode(save = false) {
  if (!_isEditing) return

  if (save && _hasChanges) {
    // Already persisted during operations
    showToast(getLang() === 'zh' ? '已保存' : 'Saved')
  }

  _isEditing = false
  _hasChanges = false
  renderLinks()

  if (save) {
    showToast(getLang() === 'zh' ? '已保存' : 'Saved')
  }

  // 退出编辑模式后重新开始折叠计时
  if (!_isExpanded) {
    startCollapseTimer()
  }
}

// ── 折叠功能 ─────────────────────────────────────────────────────────────────

function expandSection() {
  const section = document.getElementById('quickLinksSection')
  const pill = document.getElementById('qlPillTrigger')
  if (!section) return

  _isExpanded = true
  section.classList.add('expanded')
  if (pill) pill.classList.add('active')
  clearTimeout(_collapseTimer)
}

function collapseSection() {
  const section = document.getElementById('quickLinksSection')
  const pill = document.getElementById('qlPillTrigger')
  if (!section || _isEditing) return

  _isExpanded = false
  section.classList.remove('expanded')
  if (pill) pill.classList.remove('active')
}

function scheduleCollapse() {
  clearTimeout(_collapseTimer)
  _collapseTimer = setTimeout(() => {
    if (!_isEditing) collapseSection()
  }, 300) // 0.3秒后收起
}

function bindCollapse() {
  const wrapper = document.getElementById('qlWrapper')
  const pill = document.getElementById('qlPillTrigger')
  const section = document.getElementById('quickLinksSection')
  if (!wrapper || !pill) return

  // 鼠标进入 pill → 展开（仅在非搜索聚焦状态下）
  pill.addEventListener('mouseenter', () => {
    if (document.body.classList.contains('search-focused')) return
    clearTimeout(_collapseTimer)
    expandSection()
  })

  // 鼠标进入 section → 取消收起，确保保持展开
  if (section) {
    section.addEventListener('mouseenter', () => {
      if (document.body.classList.contains('search-focused')) return
      clearTimeout(_collapseTimer)
      expandSection()
    })
  }

  // 鼠标离开整个 wrapper → 延迟收起
  wrapper.addEventListener('mouseleave', () => {
    if (_isExpanded && !_isEditing) scheduleCollapse()
  })

  // 点击 pill 切换
  pill.addEventListener('click', () => {
    clearTimeout(_collapseTimer)
    if (_isExpanded) {
      collapseSection()
    } else {
      expandSection()
    }
  })
}

// 长按检测
function bindLongPress() {
  const grid = document.getElementById('quickLinksGrid')
  if (!grid) return

  grid.addEventListener('mousedown', (e) => {
    const card = e.target.closest('.ql-card')
    if (!card || _isEditing) return

    // Start long press timer
    _longPressTimer = setTimeout(() => {
      enterEditMode()
      _longPressTimer = null
    }, 1500) // 1.5 seconds
  })

  grid.addEventListener('mouseup', () => {
    if (_longPressTimer) {
      clearTimeout(_longPressTimer)
      _longPressTimer = null
    }
  })

  grid.addEventListener('mouseleave', () => {
    if (_longPressTimer) {
      clearTimeout(_longPressTimer)
      _longPressTimer = null
    }
  })
}

// 编辑模式工具栏
function bindEditToolbar() {
  const section = document.getElementById('quickLinksSection')
  if (!section) return

  // Create toolbar if not exists
  let toolbar = section.querySelector('.ql-edit-toolbar')
  if (!toolbar) {
    toolbar = document.createElement('div')
    toolbar.className = 'ql-edit-toolbar'
    toolbar.innerHTML = `
      <button class="ql-toolbar-btn ql-toolbar-btn--exit" id="qlExitBtn">
        ${getLang() === 'zh' ? '退出编辑' : 'Exit Edit'}
      </button>
    `
    section.appendChild(toolbar)
  }

  // Exit button
  const exitBtn = document.getElementById('qlExitBtn')
  exitBtn?.addEventListener('click', () => exitEditMode())
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

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
