/**
 * settings.js — Settings panel management (v2 — dual-column layout)
 *
 * Features:
 * - Left nav + right content panel layout
 * - Search history / suggestions toggles
 * - Sound effects / confetti toggles
 * - Wallpaper management embedded in Appearance panel
 * - Keyboard shortcuts reference
 * - About section
 */

const SETTINGS_KEY = 'tabnest-settings'

// ── Default Settings ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  searchHistoryEnabled: true,
  searchSuggestionsEnabled: true,
  soundEnabled: true,
  confettiEnabled: true,
  // Weather settings
  weatherProvider: 'open-meteo',  // 'open-meteo' | 'qweather' | 'openweathermap' | 'caiyun'
  weatherQweatherKey: '',
  weatherOwmKey: '',
  weatherCaiyunKey: '',
}

// ── Weather API Key Validation ───────────────────────────────────────────────
const TEST_COORDS = { lat: 39.9042, lon: 116.4074 } // 北京坐标，用于测试 API Key

async function testWeatherApi(provider, key) {
  // Open-Meteo 不需要 key，直接返回成功
  if (provider === 'open-meteo') return { valid: true }

  const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), ms))

  try {
    if (provider === 'qweather') {
      const url = `https://devapi.qweather.com/v7/weather/now?location=${TEST_COORDS.lon},${TEST_COORDS.lat}&key=${key}`
      const res = await Promise.race([fetch(url), timeout(8000)])
      const data = await res.json()
      if (data.code !== '200') {
        return { valid: false, error: `和风天气 API 错误码: ${data.code}，请检查 Key 是否正确` }
      }
      return { valid: true }

    } else if (provider === 'openweathermap') {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${TEST_COORDS.lat}&lon=${TEST_COORDS.lon}&appid=${key}&units=metric`
      const res = await Promise.race([fetch(url), timeout(8000)])
      if (!res.ok) {
        return { valid: false, error: `OpenWeatherMap HTTP 错误: ${res.status}，请检查 Key 是否正确` }
      }
      const data = await res.json()
      if (data.cod !== 200) {
        return { valid: false, error: `OpenWeatherMap 错误码: ${data.cod}，请检查 Key 是否正确` }
      }
      return { valid: true }

    } else if (provider === 'caiyun') {
      const url = `https://api.caiyunapp.com/v2.6/${key}/${TEST_COORDS.lon},${TEST_COORDS.lat}/realtime`
      const res = await Promise.race([fetch(url), timeout(8000)])
      if (!res.ok) {
        return { valid: false, error: `彩云天气 HTTP 错误: ${res.status}，请检查 Key 是否正确` }
      }
      const data = await res.json()
      if (data.status !== 'ok') {
        return { valid: false, error: `彩云天气状态: ${data.status}，请检查 Key 是否正确` }
      }
      return { valid: true }
    }
  } catch (err) {
    if (err.message === '请求超时') {
      return { valid: false, error: '请求超时，请检查网络连接' }
    }
    return { valid: false, error: `验证失败: ${err.message}，请检查 Key 是否正确` }
  }
  return { valid: true }
}

// ── State ────────────────────────────────────────────────────────────────────
let _settings = { ...DEFAULT_SETTINGS }
let _listeners = []
// 临时状态：跟踪未保存的天气设置（预览模式）
let _pendingWeather = null

// ── Init ─────────────────────────────────────────────────────────────────────
export async function initSettings() {
  await loadSettings()
  bindSettingsEvents()
}

// ── Load / Save ──────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([SETTINGS_KEY])
    if (result[SETTINGS_KEY]) {
      _settings = { ...DEFAULT_SETTINGS, ...JSON.parse(result[SETTINGS_KEY]) }
    } else {
      _settings = { ...DEFAULT_SETTINGS }
    }
  } catch (err) {
    _settings = { ...DEFAULT_SETTINGS }
  }
  applySettingsToUI()
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: JSON.stringify(_settings) })
    _listeners.forEach(cb => cb(_settings))
  } catch {}
}

export function getSettings() {
  return { ..._settings }
}

// ── Toggle ───────────────────────────────────────────────────────────────────
export async function toggleSetting(key) {
  if (key in _settings) {
    _settings[key] = !_settings[key]
    await saveSettings()
    updateToggleUI(key, _settings[key])
  }
}

export async function setSetting(key, value) {
  if (key in _settings) {
    _settings[key] = value
    await saveSettings()
    updateToggleUI(key, value)
  }
}

// ── Weather Settings ──────────────────────────────────────────────────────────
export async function setWeatherSetting(key, value) {
  _settings[key] = value
  await saveSettings()
}

export async function setWeatherProvider(provider) {
  await setWeatherSetting('weatherProvider', provider)
}

// ── UI Updates ───────────────────────────────────────────────────────────────
function applySettingsToUI() {
  Object.keys(_settings).forEach(key => updateToggleUI(key, _settings[key]))
  applyWeatherSettingsToUI()
}

function applyWeatherSettingsToUI() {
  // Provider radio — 先重置所有 radio，再设置正确的那个
  const provider = _settings.weatherProvider || 'open-meteo'
  const radios = document.querySelectorAll('[name="weather-provider"]')
  radios.forEach(radio => {
    radio.checked = (radio.value === provider)
  })
  // API key inputs
  const qkeyInput  = document.getElementById('weather-qweather-key')
  const okeyInput  = document.getElementById('weather-owm-key')
  const ckeyInput  = document.getElementById('weather-caiyun-key')
  if (qkeyInput)  qkeyInput.value  = _settings.weatherQweatherKey  || ''
  if (okeyInput)  okeyInput.value  = _settings.weatherOwmKey      || ''
  if (ckeyInput)  ckeyInput.value  = _settings.weatherCaiyunKey    || ''
  // Show/hide API key rows
  updateWeatherKeyRows(provider)

  // 🔔 检测 fallback 状态：如果选择了需要 key 的 provider 但没填，显示警告
  const keyMap = {
    qweather: _settings.weatherQweatherKey,
    openweathermap: _settings.weatherOwmKey,
    caiyun: _settings.weatherCaiyunKey,
  }
  const missingKey = keyMap[provider]
  const warningEl = document.getElementById('weather-key-missing-warning')
  if (warningEl) {
    if (provider !== 'open-meteo' && !missingKey) {
      warningEl.style.display = 'block'
      warningEl.textContent = `⚠️ 您选择了 ${provider === 'qweather' ? '和风天气' : provider === 'openweathermap' ? 'OpenWeatherMap' : '彩云天气'}，但未填写 API Key。主界面目前使用的是 Open-Meteo。`
    } else {
      warningEl.style.display = 'none'
    }
  }
}

function updateWeatherKeyRows(provider) {
  document.getElementById('weather-qweather-key-row').style.display = provider === 'qweather' ? 'flex' : 'none'
  document.getElementById('weather-owm-key-row').style.display     = provider === 'openweathermap' ? 'flex' : 'none'
  document.getElementById('weather-caiyun-key-row').style.display  = provider === 'caiyun' ? 'flex' : 'none'
}

function updateToggleUI(key, value) {
  const toggle = document.getElementById(`setting-${key}`)
  if (!toggle) return
  toggle.classList.toggle('active', !!value)
  toggle.setAttribute('aria-checked', String(!!value))
}

// ── Nav panel switching ───────────────────────────────────────────────────────
function switchPanel(panelId) {
  // Guard: if panelId is not a valid string (e.g. accidentally passed a MouseEvent), fallback
  if (typeof panelId !== 'string') panelId = 'search'
  // Update nav items
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.panel === panelId)
  })
  // Update panels
  document.querySelectorAll('.settings-panel').forEach(panel => {
    const isActive = panel.id === `settings-panel-${panelId}`
    panel.style.display = isActive ? 'block' : 'none'
    panel.classList.toggle('active', isActive)
  })
  // When switching to appearance, re-init wallpaper UI
  if (panelId === 'appearance') {
    initWallpaperInSettings()
  }
  // When switching to weather, fully re-apply weather settings (radio checked + key rows)
  if (panelId === 'weather') {
    applyWeatherSettingsToUI()
  }
}

// ── Wallpaper integration (inline in settings panel) ──────────────────────────
function initWallpaperInSettings() {
  // Delegate to wallpaper module via event
  document.dispatchEvent(new CustomEvent('settings:open-wallpaper'))
}

// ── Event Binding ─────────────────────────────────────────────────────────────
function bindSettingsEvents() {
  // Settings button (corner panel)
  const settingsBtn = document.getElementById('cornerSettingsBtn')
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => openSettings('search'))
  }

  // Close settings
  const closeBtn = document.getElementById('settingsModalClose')
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSettings)
  }

  // Click backdrop to close
  const modal = document.getElementById('settingsModal')
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSettings()
    })
  }

  // Left nav item clicks
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchPanel(item.dataset.panel)
    })
  })

  // Toggle switches
  document.querySelectorAll('.settings-toggle').forEach(toggle => {
    toggle.addEventListener('click', async () => {
      await toggleSetting(toggle.dataset.setting)
    })
  })

  // Weather provider radio — 预览模式：只更新 UI，不自动保存
  document.querySelectorAll('[name="weather-provider"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      _pendingWeather = { ..._settings, weatherProvider: e.target.value }
      updateWeatherKeyRows(e.target.value)
      // UI 已更新，但不保存。用户需要点击保存按钮才生效。
    })
  })

  // Weather API key inputs — 预览模式：只更新临时状态，不自动保存
  const qkeyInput = document.getElementById('weather-qweather-key')
  const okeyInput = document.getElementById('weather-owm-key')
  const ckeyInput = document.getElementById('weather-caiyun-key')

  if (qkeyInput) {
    qkeyInput.addEventListener('change', (e) => {
      if (!_pendingWeather) {
        _pendingWeather = { ..._settings }
      }
      _pendingWeather.weatherQweatherKey = e.target.value.trim()
    })
  }
  if (okeyInput) {
    okeyInput.addEventListener('change', (e) => {
      if (!_pendingWeather) {
        _pendingWeather = { ..._settings }
      }
      _pendingWeather.weatherOwmKey = e.target.value.trim()
    })
  }
  if (ckeyInput) {
    ckeyInput.addEventListener('change', (e) => {
      if (!_pendingWeather) {
        _pendingWeather = { ..._settings }
      }
      _pendingWeather.weatherCaiyunKey = e.target.value.trim()
    })
  }

  // Weather save button — 保存所有天气设置并刷新天气
  const saveBtn = document.getElementById('weatherSaveBtn')
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      // 从 UI 读取当前值（可能包含未保存的预览更改）
      const selectedRadio = document.querySelector('[name="weather-provider"]:checked')
      const provider = selectedRadio?.value || _settings.weatherProvider
      const qkey = document.getElementById('weather-qweather-key')?.value?.trim() || ''
      const okey = document.getElementById('weather-owm-key')?.value?.trim() || ''
      const ckey = document.getElementById('weather-caiyun-key')?.value?.trim() || ''

      // 🔒 验证：需要 key 的 provider 必须填写 key
      const keyMap = { qweather: qkey, openweathermap: okey, caiyun: ckey }
      const requiredKey = keyMap[provider]
      if (provider !== 'open-meteo' && !requiredKey) {
        // 显示错误提示
        saveBtn.textContent = '请先填写 API Key'
        saveBtn.style.background = 'var(--error, #ef4444)'
        setTimeout(() => {
          saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> 保存并刷新天气`
          saveBtn.style.background = ''
        }, 2000)
        return // 不保存，直接退出
      }

      // 🔒 验证 Key 有效性：需要 key 的 provider 要测试 Key 是否可用
      if (provider !== 'open-meteo') {
        saveBtn.textContent = '正在验证 Key...'
        saveBtn.disabled = true
        const result = await testWeatherApi(provider, requiredKey)
        saveBtn.disabled = false
        saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> 保存并刷新天气`

        if (!result.valid) {
          // Key 无效，显示具体错误
          saveBtn.textContent = 'Key 无效'
          saveBtn.style.background = 'var(--error, #ef4444)'
          // 在警告区域显示详细错误信息
          const warningEl = document.getElementById('weather-key-missing-warning')
          if (warningEl) {
            warningEl.innerHTML = `❌ <strong>API Key 验证失败：</strong>${result.error}`
            warningEl.style.background = 'rgba(239, 68, 68, 0.15)'
            warningEl.style.borderColor = 'rgba(239, 68, 68, 0.4)'
            warningEl.style.color = '#dc2626'
            warningEl.style.display = 'block'
          }
          setTimeout(() => {
            saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> 保存并刷新天气`
            saveBtn.style.background = ''
          }, 3000)
          return
        }
      }

      // ✅ 验证通过，保存所有 weather 设置
      await setWeatherSetting('weatherProvider', provider)
      await setWeatherSetting('weatherQweatherKey', qkey)
      await setWeatherSetting('weatherOwmKey', okey)
      await setWeatherSetting('weatherCaiyunKey', ckey)

      // 清除预览状态
      _pendingWeather = null

      // 清除警告信息
      const warningEl = document.getElementById('weather-key-missing-warning')
      if (warningEl) {
        warningEl.innerHTML = ''
        warningEl.style.display = 'none'
      }

      // Dispatch 刷新天气（根据新 provider）
      document.dispatchEvent(new CustomEvent('weather:provider-changed', { detail: provider }))

      // Show brief feedback
      saveBtn.textContent = '已保存!'
      saveBtn.style.background = 'var(--success, #22c55e)'
      setTimeout(() => {
        saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> 保存并刷新天气`
        saveBtn.style.background = ''
      }, 1500)
    })
  }
}

// ── Open / Close ─────────────────────────────────────────────────────────────
export async function openSettings(panelId = 'search') {
  const modal = document.getElementById('settingsModal')
  if (!modal) return

  document.body.classList.add('modal-open')
  modal.style.display = 'flex'

  // Always reload from storage to get latest settings (ignore cached _settings)
  await loadSettings()

  // 安全延迟确保 DOM 准备就绪
  await new Promise(resolve => setTimeout(resolve, 10))

  // 确保 UI 与刚加载的 _settings 一致
  applySettingsToUI()
  switchPanel(panelId)
}

export function closeSettings() {
  const modal = document.getElementById('settingsModal')
  if (modal) {
    document.body.classList.remove('modal-open')
    modal.style.display = 'none'
    // 关闭时如果有未保存的预览状态，重置 UI 到已保存的状态
    if (_pendingWeather !== null) {
      _pendingWeather = null
      applySettingsToUI()
    }
  }
}

// ── Listeners ────────────────────────────────────────────────────────────────
export function onSettingsChange(callback) {
  _listeners.push(callback)
}

// ── Sync checks ──────────────────────────────────────────────────────────────
export function isSearchHistoryEnabled()     { return _settings.searchHistoryEnabled }
export function isSearchSuggestionsEnabled() { return _settings.searchSuggestionsEnabled }
export function isSoundEnabled()             { return _settings.soundEnabled }
export function isConfettiEnabled()          { return _settings.confettiEnabled }
export function getWeatherProvider()         { return _settings.weatherProvider || 'open-meteo' }
export function getQweatherKey()            { return _settings.weatherQweatherKey || '' }
export function getOwmKey()                 { return _settings.weatherOwmKey || '' }
export function getCaiyunKey()              { return _settings.weatherCaiyunKey || '' }
