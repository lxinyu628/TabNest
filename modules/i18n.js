/**
 * i18n.js — Internationalization system (zh / en)
 *
 * Usage:
 *   import { t, setLang, getLang, applyTranslations, initI18n } from './modules/i18n.js'
 *
 * Static HTML elements:  <span data-i18n="key.subkey"></span>
 * Programmatic text:       t('key.subkey')
 * Placeholders:           data-i18n-placeholder="key.subkey"
 */

const LANG_KEY = 'organizetab-lang'

// ── Translation map ────────────────────────────────────────────────────────
const T = {
  zh: {
    greeting: { morning: '早上好', afternoon: '下午好', evening: '晚上好' },
    date:     'yyyy年M月d日 星期E',
    theme:    { light: '浅色', dark: '深色', system: '跟随系统' },
    lang:     { zh: '简体中文', en: 'English' },
    group:    { homepages: '首页' },
    search:   { placeholder: '搜索或输入网址…', searchTabs: '搜索标签页' },
    banner: {
      dupe:       '当前有 <strong>{n}</strong> 个 Organize Tab 标签页。保留这一个？',
      dupeAction: '关闭多余',
    },
    section: {
      openTabs: '已打开标签',
      saved:    '稍后阅读',
      archive:  '归档',
      recentlyClosed: '最近关闭',
      quickLinks: '快捷链接',
    },
    stat: {
      tabs: '个已打开标签',
      tabsOpen: 'tabs open',
      closedToday: '今天关闭了',
    },
    bottomBar: {
      organize: '整理标签',
      manage: '管理标签页',
      searchTabs: '搜索标签页',
    },
    empty: {
      saved:  '还没有保存任何标签。',
      domain: '全部搞定，标签已清空。',
    },
    toast: {
      closedGroup:    '已关闭 {n} 个标签',
      closedTab:     '已关闭标签',
      closedSelfDupes: '已关闭重复标签',
      savedTab:      '已保存到稍后阅读',
      alreadySaved:  '已在稍后阅读列表中',
      unmarked:      '已取消完成',
      deleted:       '已删除',
      confirmClose:  '关闭全部 {n} 个标签？',
      cleared:       '归档已清空',
      saveFailed:    '保存失败',
      dupClosed:     '重复标签已关闭',
      freshStart:    '全部清空，全新开始',
      tabReopened:   '已重新打开标签',
    },
    confirm: {
      title:        '确认操作',
      ok:           '确定',
      cancel:       '取消',
      closeSingle:  '确定要关闭这个标签页吗？',
      closeGroup:   '确定要关闭「{label}」下的 {count} 个标签页吗？',
      closeDupes:   '确定要关闭 {n} 个重复标签页吗？',
      closeAll:     '确定要关闭全部 {n} 个标签页吗？',
      closeSelfDupes: '确定要关闭 {n} 个多余的扩展标签页吗？',
      deleteLink:   '确定要删除「{name}」吗？',
      deleteConfirm: '确认删除',
    },
    archive: {
      search: '搜索归档标签…',
      noResults: '无结果',
    },
    drawer: {
      searchPlaceholder: '搜索标签页…',
      noResults: '没有匹配的标签页',
    },
    // Misc dynamic
    tabN: '{n} 个标签',
    ql: {
      add:       '添加链接',
      edit:      '编辑链接',
      url:       '网址',
      urlPlaceholder: 'https://github.com',
      title:     '名称（可选）',
      titlePlaceholder: 'GitHub',
      addCurrentTabSuccess: '已添加当前页面',
      addCurrentTabError: '无法获取当前页面',
      addCurrentTabRestricted: '无法添加此页面（仅支持 http/https 网页）',
      pill: '快捷书签',
    },
    aria: {
      close: '关闭',
    },
    wallpaper: {
      title: '更换壁纸',
      gradient: '渐变背景',
      image: '自定义图片',
      random: '随机壁纸',
      uploadHint: '点击或拖拽图片到此处上传',
      uploadTip: '支持 JPG、PNG、WebP，建议尺寸 1920x1080',
      clear: '清除自定义壁纸',
      getRandom: '换一换',
      randomDesc: '点击下方按钮获取一张随机高清壁纸',
      applied: '壁纸已更新',
    },
    settings: {
      title: '设置',
      nav: {
        search: '搜索',
        appearance: '外观 / 壁纸',
        effects: '动效',
        weather: '天气',
        shortcuts: '快捷键',
        about: '关于',
      },
      search: {
        title: '搜索设置',
        history: '搜索历史',
        historyDesc: '聚焦搜索框时显示历史记录',
        suggestions: '搜索建议',
        suggestionsDesc: '输入时显示实时搜索建议',
      },
      appearance: {
        title: '外观 / 壁纸',
        gradient: '渐变背景',
        image: '自定义图片',
        random: '随机壁纸',
        gradientDesc: '选择一个渐变配色作为背景',
        uploadDesc: '支持 JPG / PNG / WebP，拖拽或点击上传',
        uploadBtn: '点击上传图片',
        clearWallpaper: '清除自定义壁纸',
        randomDesc: '获取在线随机风景壁纸（点击预览图应用）',
        applyWallpaper: '点击应用此壁纸',
        shuffle: '换一换',
      },
      effects: {
        title: '动效设置',
        sound: '关闭音效',
        soundDesc: '关闭标签时播放愉悦的音效',
        confetti: '彩纸效果',
        confettiDesc: '关闭标签时显示彩纸动画',
      },
      weather: {
        title: '天气设置',
        desc: '选择天气数据来源。免费无需 Key，或填写第三方 API Key 获得更精准的数据',
        free: '免费',
        openmeteo: 'Open-Meteo（默认）',
        openmeteoDesc: '完全免费，无需 API Key，数据源自欧洲气象模型',
        qweather: '和风天气',
        qweatherDesc: '国内数据最精准，支持小时级预报和空气质量',
        qweatherKey: '和风天气 API Key',
        owmDesc: '全球覆盖，支持中文，数据较准确',
        caiyun: '彩云天气',
        caiyunDesc: '分钟级降水预测，国内最精准，数据质量高',
        caiyunToken: '彩云天气 Token',
        keyPlaceholder: '请粘贴 API Key',
        tokenPlaceholder: '请粘贴 Token',
        saveBtn: '保存并刷新天气',
        hint: '填写 Key 后点击上方按钮保存并刷新天气',
      },
      shortcuts: {
        title: '键盘快捷键',
        focus: '聚焦搜索框',
        zen: '极简模式',
        exit: '退出极简模式 / 关闭弹窗',
      },
      about: {
        title: '关于',
        desc: '你的浏览器起始页。实时时钟、多引擎搜索、快捷书签、天气信息、一言卡片、极简模式、标签管理抽屉——全部聚合在新标签页，一目了然。',
      },
    },
  },

  en: {
    greeting: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    date:     'EEEE, MMMM d, yyyy',
    theme:    { light: 'Light', dark: 'Dark', system: 'System' },
    lang:     { zh: '简体中文', en: 'English' },
    group:    { homepages: 'Homepages' },
    search:   { placeholder: 'Search or enter a URL…', searchTabs: 'Search tabs' },
    banner: {
      dupe:       'You have <strong>{n}</strong> Organize Tab tabs open. Keep just this one?',
      dupeAction: 'Close extras',
    },
    section: {
      openTabs: 'Open tabs',
      saved:    'Saved for later',
      archive:  'Archive',
      recentlyClosed: 'Recently Closed',
      quickLinks: 'Quick Links',
    },
    stat: {
      tabs: 'open tabs',
      tabsOpen: 'tabs open',
      closedToday: 'Closed today',
    },
    bottomBar: {
      organize: 'Organize',
      manage: 'Manage Tabs',
      searchTabs: 'Search Tabs',
    },
    empty: {
      saved:  'Nothing saved yet.',
      domain: 'Inbox zero, but for tabs.',
    },
    toast: {
      closedGroup:    'Closed {n} tabs',
      closedTab:     'Tab closed',
      closedSelfDupes: 'Duplicates closed',
      savedTab:      'Saved for later',
      alreadySaved:  'Already in saved list',
      unmarked:      'Marked as unread',
      deleted:       'Deleted',
      confirmClose:  'Close all {n} tabs?',
      cleared:       'Archive cleared',
      saveFailed:    'Failed to save tab',
      dupClosed:     'Duplicates closed, kept one copy each',
      freshStart:    'All tabs closed. Fresh start.',
      tabReopened:   'Tab reopened',
    },
    confirm: {
      title:        'Confirm',
      ok:           'OK',
      cancel:       'Cancel',
      closeSingle:  'Close this tab?',
      closeGroup:   'Close {count} tabs from "{label}"?',
      closeDupes:   'Close {n} duplicate tabs?',
      closeAll:     'Close all {n} tabs?',
      closeSelfDupes: 'Close {n} extra extension tabs?',
      deleteLink:   'Delete "{name}"?',
      deleteConfirm: 'Confirm Delete',
    },
    archive: {
      search: 'Search archived tabs…',
      noResults: 'No results',
    },
    drawer: {
      searchPlaceholder: 'Search tabs…',
      noResults: 'No matching tabs',
    },
    tabN: '{n} tabs',
    ql: {
      add:       'Add link',
      edit:      'Edit link',
      url:       'URL',
      urlPlaceholder: 'https://github.com',
      title:     'Name (optional)',
      titlePlaceholder: 'GitHub',
      addCurrentTabSuccess: 'Added current page',
      addCurrentTabError: 'Cannot get current page',
      addCurrentTabRestricted: 'Cannot add this page (http/https only)',
      pill: 'Quick Links',
    },
    aria: {
      close: 'Close',
    },
    wallpaper: {
      title: 'Change Wallpaper',
      gradient: 'Gradient',
      image: 'Custom Image',
      random: 'Random',
      uploadHint: 'Click or drag image here to upload',
      uploadTip: 'Supports JPG, PNG, WebP. Recommended: 1920x1080',
      clear: 'Clear custom wallpaper',
      getRandom: 'Shuffle',
      randomDesc: 'Click below to get a random HD wallpaper',
      applied: 'Wallpaper applied',
    },
    settings: {
      title: 'Settings',
      nav: {
        search: 'Search',
        appearance: 'Appearance',
        effects: 'Effects',
        weather: 'Weather',
        shortcuts: 'Shortcuts',
        about: 'About',
      },
      search: {
        title: 'Search Settings',
        history: 'Search History',
        historyDesc: 'Show history when search bar is focused',
        suggestions: 'Search Suggestions',
        suggestionsDesc: 'Show real-time suggestions as you type',
      },
      appearance: {
        title: 'Appearance / Wallpaper',
        gradient: 'Gradient',
        image: 'Custom Image',
        random: 'Random Wallpaper',
        gradientDesc: 'Choose a gradient color as the background',
        uploadDesc: 'Supports JPG / PNG / WebP, drag or click to upload',
        uploadBtn: 'Click to upload image',
        clearWallpaper: 'Clear custom wallpaper',
        randomDesc: 'Get random HD wallpapers online (click preview to apply)',
        applyWallpaper: 'Click to apply this wallpaper',
        shuffle: 'Shuffle',
      },
      effects: {
        title: 'Effect Settings',
        sound: 'Close Sound',
        soundDesc: 'Play a pleasant sound when closing tabs',
        confetti: 'Confetti Effect',
        confettiDesc: 'Show confetti animation when closing tabs',
      },
      weather: {
        title: 'Weather Settings',
        desc: 'Choose a weather data source. Free options need no Key, or enter a third-party API Key for more accurate data.',
        free: 'Free',
        openmeteo: 'Open-Meteo (default)',
        openmeteoDesc: 'Completely free, no API Key needed, data from European weather models',
        qweather: 'Qweather',
        qweatherDesc: 'Most accurate domestic data, hourly forecast and air quality support',
        qweatherKey: 'Qweather API Key',
        owmDesc: 'Global coverage, supports Chinese, fairly accurate data',
        caiyun: 'Caiyun Weather',
        caiyunDesc: 'Minute-level precipitation prediction, most accurate domestically',
        caiyunToken: 'Caiyun Weather Token',
        keyPlaceholder: 'Paste API Key here',
        tokenPlaceholder: 'Paste Token here',
        saveBtn: 'Save & Refresh Weather',
        hint: 'After entering Key, click the button above to save and refresh',
      },
      shortcuts: {
        title: 'Keyboard Shortcuts',
        focus: 'Focus search bar',
        zen: 'Zen mode',
        exit: 'Exit Zen mode / Close dialog',
      },
      about: {
        title: 'About',
        desc: "Your new tab homepage. Real-time clock, multi-engine search, quick bookmarks, weather, quotes, zen mode, and a powerful tab manager — all in one place.",
      },
    },
  },
}

// ── Language helpers ───────────────────────────────────────────────────────
let _cachedLang = null // In-memory cache for sync access

async function loadLangFromStorage() {
  try {
    const result = await chrome.storage.local.get(LANG_KEY)
    _cachedLang = result[LANG_KEY] || null
  } catch {
    _cachedLang = null
  }
}

export function getLang() {
  return _cachedLang
}

export async function setLang(lang) {
  _cachedLang = lang
  try {
    await chrome.storage.local.set({ [LANG_KEY]: lang })
  } catch (e) { console.error('[i18n] Storage error:', e) }
  applyTranslations(lang)

  // Update language option active states
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang)
  })

  // Notify other modules (e.g. hitokoto) about language change
  document.dispatchEvent(new CustomEvent('tabnest-lang-change', { detail: { lang } }))
}

// ── Translate a key ────────────────────────────────────────────────────────
function getNested(obj, path) {
  if (!path) return null
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj)
}

/**
 * Translate a dot-notation key.
 * @param {string} key  e.g. "greeting.morning" or "toast.closedGroup"
 * @param {object} params  e.g. { n: 5 } → "Closed 5 tabs"
 */
export function t(key, params = {}) {
  const lang = getLang() || 'zh'
  const text = getNested(T[lang], key) ?? getNested(T.zh, key) ?? key
  return String(text).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`)
}

// ── Apply i18n to DOM ──────────────────────────────────────────────────────
export function applyTranslations(lang = null) {
  lang = lang || getLang() || 'zh'

  // Update <html lang>
  document.documentElement.setAttribute('lang', lang)

  // Translate all [data-i18n]
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')
    const text = getNested(T[lang], key) ?? key
    el.innerHTML = text
  })

  // Translate placeholders [data-i18n-placeholder]
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder')
    el.placeholder = getNested(T[lang], key) ?? key
  })

  // Translate aria-labels [data-i18n-aria]
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria')
    el.setAttribute('aria-label', getNested(T[lang], key) ?? key)
  })

  // Translate aria-labels where data-i18n="aria.xxx" (uses setAttribute for aria-label)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')
    if (key.startsWith('aria.')) {
      el.setAttribute('aria-label', getNested(T[lang], key) ?? key)
    }
  })

// Update theme menu active states
  document.querySelectorAll('.theme-option').forEach(btn => {
    const key = btn.getAttribute('data-i18n')
    if (!key) return
    const text = getNested(T[lang], key)
    const span = btn.querySelector('span')
    if (text && span) span.textContent = text
  })
}

// ── Init: set up language toggle button ───────────────────────────────────
export async function initI18n() {
  await loadLangFromStorage()
  const lang = getLang() || 'zh'
  applyTranslations(lang)

  // Update search placeholder immediately
  const searchInput = document.getElementById('searchInput')
  if (searchInput) {
    searchInput.placeholder = getNested(T[lang], 'search.placeholder') || '搜索…'
  }

  // Get DOM references
  const langBtn = document.getElementById('langBtn')
  const langMenu = document.getElementById('langMenu')
  const themeMenu = document.getElementById('themeMenu')

  // Move langMenu to document.body (same as themeMenu) to avoid stacking context issues
  if (langMenu && langMenu.parentElement !== document.body) {
    document.body.appendChild(langMenu)
  }

  // Update active state on lang menu options
  function updateLangActiveState() {
    const currentLang = getLang() || 'zh'
    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang)
    })
  }
  updateLangActiveState()

  function closeLangMenu() {
    if (langMenu) langMenu.style.display = 'none'
  }

  // Language button click - toggle dropdown
  if (langBtn) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation()

      // Close search overlay if open
      const mainSearch = document.getElementById('mainSearch')
      if (mainSearch) mainSearch.blur()
      document.body.classList.remove('search-focused')

      if (!langMenu) return

      if (langMenu.style.display === 'block') {
        closeLangMenu()
      } else {
        // Close theme menu first
        if (themeMenu) themeMenu.style.display = 'none'
        // Position and show lang menu
        const rect = langBtn.getBoundingClientRect()
        langMenu.style.top = (rect.bottom + 8) + 'px'
        langMenu.style.right = (window.innerWidth - rect.right) + 'px'
        langMenu.style.left = 'auto'
        langMenu.style.display = 'block'
        updateLangActiveState()
      }
    })
  }

  // Close lang menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!langMenu || langMenu.style.display !== 'block') return
    if (e.target.closest('#langMenu') || e.target.closest('#langBtn')) return
    closeLangMenu()
  })

  // Handle ESC key to close lang menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLangMenu()
  })

  // Lang option selection — direct onclick on each button (most reliable)
  if (langMenu) {
    langMenu.querySelectorAll('.lang-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const next = btn.dataset.lang
        if (!next) return
        setLang(next).then(() => {
          closeLangMenu()
          const si = document.getElementById('searchInput')
          if (si) si.placeholder = getNested(T[next], 'search.placeholder') || '搜索…'
        })
      })
    })
  }
}
