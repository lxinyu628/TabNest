/**
 * weather.js — Multi-provider weather display
 * Supports: Open-Meteo (default, no key), QWeather, OpenWeatherMap, Caiyun
 * Uses chrome.storage.local for persistence.
 */

import { t, getLang } from './i18n.js'
import { getSettings } from './settings.js'
import { showToast } from './ui.js'

// ── Storage keys ──────────────────────────────────────────────────────────────
const WEATHER_KEY     = 'organizetab-weather'
const WEATHER_CITY_KEY = 'organizetab-weather-city'
const CACHE_TTL       = 45 * 60 * 1000 // 45 minutes — 延长缓存减少 API 调用

// ── Manual refresh rate limit ─────────────────────────────────────────────────
const REFRESH_COOLDOWN = 2 * 60 * 1000 // 2 分钟冷却时间，避免触发平台风控
let _lastManualRefresh = 0 // 上次手动刷新时间

// ── State ────────────────────────────────────────────────────────────────────
let _cachedWeather = null
let _cachedCity    = null

// ── WMO Weather Code → icon & label (for Open-Meteo) ────────────────────────
const WMO_CODES = {
  0:  { label: 'Clear',         labelZh: '晴',      icon: 'sunny' },
  1:  { label: 'Clear',         labelZh: '晴',      icon: 'sunny' },
  2:  { label: 'Partly cloudy', labelZh: '多云',    icon: 'partly-cloudy' },
  3:  { label: 'Overcast',      labelZh: '阴',      icon: 'cloudy' },
  45: { label: 'Fog',           labelZh: '雾',      icon: 'foggy' },
  48: { label: 'Fog',           labelZh: '雾',      icon: 'foggy' },
  51: { label: 'Drizzle',        labelZh: '毛毛雨', icon: 'drizzle' },
  53: { label: 'Drizzle',        labelZh: '毛毛雨', icon: 'drizzle' },
  55: { label: 'Drizzle',        labelZh: '毛毛雨', icon: 'drizzle' },
  61: { label: 'Rain',          labelZh: '小雨',    icon: 'rainy' },
  63: { label: 'Rain',          labelZh: '中雨',    icon: 'rainy' },
  65: { label: 'Rain',          labelZh: '大雨',    icon: 'rainy' },
  71: { label: 'Snow',          labelZh: '小雪',    icon: 'snowy' },
  73: { label: 'Snow',          labelZh: '中雪',    icon: 'snowy' },
  75: { label: 'Snow',          labelZh: '大雪',    icon: 'snowy' },
  77: { label: 'Snow grains',   labelZh: '冰粒',    icon: 'snowy' },
  80: { label: 'Showers',       labelZh: '阵雨',    icon: 'showers' },
  81: { label: 'Showers',       labelZh: '阵雨',    icon: 'showers' },
  82: { label: 'Heavy showers', labelZh: '强阵雨',  icon: 'showers' },
  85: { label: 'Snow showers',  labelZh: '阵雪',    icon: 'snowy' },
  86: { label: 'Snow showers',  labelZh: '强阵雪',  icon: 'snowy' },
  95: { label: 'Thunderstorm', labelZh: '雷暴',    icon: 'thunderstorm' },
  96: { label: 'Thunderstorm',  labelZh: '雷暴',    icon: 'thunderstorm' },
  99: { label: 'Thunderstorm',  labelZh: '雷暴',    icon: 'thunderstorm' },
}

// OpenWeatherMap condition → our icon key
const OWM_CODES = {
  '01': 'sunny', '02': 'partly-cloudy', '03': 'cloudy', '04': 'cloudy',
  '09': 'rainy', '10': 'drizzle', '11': 'thunderstorm',
  '13': 'snowy', '50': 'foggy',
}

// ── SVG Icons ────────────────────────────────────────────────────────────────
const WEATHER_ICONS = {
  sunny: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
  </svg>`,
  'partly-cloudy': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-4.7-7.3" opacity="0.7"/>
  </svg>`,
  cloudy: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-4.7-7.3 4.5 4.5 0 0 0-3.8-2.2" opacity="0.9"/>
  </svg>`,
  foggy: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 15h18M3 9h18M7 21h10M5 3h14" opacity="0.6"/>
  </svg>`,
  rainy: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-4.7-7.3 4.5 4.5 0 0 0-3.8-2.2" opacity="0.9"/>
    <path stroke-linecap="round" stroke-linejoin="round" d="M8 19v2M12 19v2M16 19v2" opacity="0.6"/>
  </svg>`,
  drizzle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-4.7-7.3 4.5 4.5 0 0 0-3.8-2.2" opacity="0.8"/>
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v1M12 19v1" opacity="0.5"/>
  </svg>`,
  snowy: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-4.7-7.3 4.5 4.5 0 0 0-3.8-2.2" opacity="0.9"/>
    <path stroke-linecap="round" stroke-linejoin="round" d="M8 19v1.5M12 19v1.5M16 19v1.5" opacity="0.6"/>
  </svg>`,
  showers: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-4.7-7.3 4.5 4.5 0 0 0-3.8-2.2" opacity="0.9"/>
    <path stroke-linecap="round" stroke-linejoin="round" d="M7 19v2M11 19v2M15 19v2" opacity="0.6"/>
  </svg>`,
  thunderstorm: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-4.7-7.3 4.5 4.5 0 0 0-3.8-2.2" opacity="0.9"/>
    <path stroke-linecap="round" stroke-linejoin="round" d="M13 12 9 17h4l-2 5" opacity="0.8"/>
  </svg>`,
  'location-pin': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>`,
  'city-building': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
  </svg>`,
  'loading': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>`,
}

// ── Provider implementations ──────────────────────────────────────────────────

/**
 * Fetch weather from Open-Meteo (default, no key required)
 * API: https://api.open-meteo.com/v1/forecast
 */
async function fetchOpenMeteo(coords, city, country) {
  const { lat, lon } = coords
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
  const res = await fetchWithTimeout(url, 8000)
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)
  const data = await res.json()
  const cw = data.current_weather
  const info = WMO_CODES[cw.weathercode] || { label: 'Unknown', labelZh: '未知', icon: 'sunny' }
  return {
    temp: Math.round(cw.temperature),
    code: cw.weathercode,
    label: info.label,
    labelZh: info.labelZh,
    icon: info.icon,
    windspeed: Math.round(cw.windspeed),
    city: city || null,
    country: country || null,
    time: Date.now(),
    coords: { lat, lon },
  }
}

/**
 * Fetch weather from 和风天气 (QWeather)
 * API: https://dev.qweather.com/docs/api/weather/weather-now/
 * Key: Free tier 1000 calls/day
 */
async function fetchQWeather(coords, city, country, key) {
  const { lat, lon } = coords
  const url = `https://devapi.qweather.com/v7/weather/now?location=${lon},${lat}&key=${key}`
  const res = await fetchWithTimeout(url, 8000)
  if (!res.ok) throw new Error(`QWeather error: ${res.status}`)
  const data = await res.json()
  if (data.code !== '200') throw new Error(`QWeather API error: ${data.code}`)
  const now = data.now
  return {
    temp: Math.round(parseFloat(now.temp)),
    code: parseInt(now.icon),
    label: now.text,
    labelZh: now.text,
    icon: weatherCodeToIcon(parseInt(now.icon)),
    windspeed: Math.round(parseFloat(now.windSpeed)),
    city: city || now.name || null,
    country: country || null,
    time: Date.now(),
    coords: { lat, lon },
  }
}

/**
 * Fetch weather from OpenWeatherMap
 * API: https://openweathermap.org/current
 * Key: Free tier 60 calls/min, 1M calls/month
 */
async function fetchOpenWeatherMap(coords, city, country, key) {
  const { lat, lon } = coords
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=zh_cn`
  const res = await fetchWithTimeout(url, 8000)
  if (!res.ok) throw new Error(`OWM error: ${res.status}`)
  const data = await res.json()
  const iconKey = (data.weather?.[0]?.icon || '01').substring(0, 2)
  return {
    temp: Math.round(data.main.temp),
    code: parseInt(data.weather?.[0]?.id || 800),
    label: data.weather?.[0]?.description || 'Unknown',
    labelZh: data.weather?.[0]?.description || '未知',
    icon: OWM_CODES[iconKey] || 'sunny',
    windspeed: Math.round(data.wind?.speed || 0),
    city: city || data.name || null,
    country: country || data.sys?.country || null,
    time: Date.now(),
    coords: { lat, lon },
  }
}

/**
 * Fetch weather from 彩云天气 (Caiyun)
 * API: https://open.caiyunapp.com
 * Token: Free registration required
 */
async function fetchCaiyun(coords, city, country, token) {
  const { lat, lon } = coords
  const url = `https://api.caiyunapp.com/v2.6/${token}/${lon},${lat}/realtime?lang=zh_cn`
  const res = await fetchWithTimeout(url, 8000)
  if (!res.ok) throw new Error(`Caiyun error: ${res.status}`)
  const data = await res.json()
  if (data.status !== 'ok') throw new Error(`Caiyun API error: ${data.status}`)
  const result = data.result
  const skycon = result.skycon
  const info = skyconToInfo(skycon)
  return {
    temp: Math.round(result.temperature),
    code: skyconCode(skycon),
    label: info.label,
    labelZh: info.labelZh,
    icon: info.icon,
    windspeed: Math.round(result.wind?.speed || 0),
    city: city || null,
    country: country || null,
    time: Date.now(),
    coords: { lat, lon },
  }
}

// ── Geocoding (used by all providers) ────────────────────────────────────────

async function geocodeCity(cityName) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=zh&format=json`
    const res = await fetchWithTimeout(url, 5000)
    if (!res.ok) throw new Error(`Geocoding error: ${res.status}`)
    const data = await res.json()
    if (!data.results || data.results.length === 0) return null
    const r = data.results[0]
    return { lat: r.latitude, lon: r.longitude, city: r.name, country: r.country }
  } catch {
    return null
  }
}

// ── Fetch with timeout helper ────────────────────────────────────────────────

function fetchWithTimeout(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    fetch(url)
      .then(res => { clearTimeout(timer); resolve(res) })
      .catch(err => { clearTimeout(timer); reject(err) })
  })
}

// ── Default cities for fallback (when geolocation fails) ───────────────────

const DEFAULT_CITIES = [
  { name: 'Beijing',   lat: 39.9042,  lon: 116.4074 },
  { name: 'Shanghai',  lat: 31.2304,  lon: 121.4737 },
  { name: 'Guangzhou', lat: 23.1291,  lon: 113.2644 },
  { name: 'Shenzhen',  lat: 22.5431,  lon: 114.0579 },
  { name: 'Chengdu',   lat: 30.5728,  lon: 104.0668 },
]

// ── Weather code mappers ──────────────────────────────────────────────────────

function weatherCodeToIcon(code) {
  // QWeather uses numeric codes (1-32+)
  const mapping = {
    1:'sunny', 2:'sunny', 3:'partly-cloudy', 4:'cloudy',
    5:'foggy', 6:'foggy', 7:'foggy',
    8:'rainy', 9:'rainy', 10:'rainy', 11:'rainy',
    12:'drizzle', 13:'drizzle', 14:'drizzle', 15:'drizzle',
    16:'rainy', 17:'rainy', 18:'rainy', 19:'rainy',
    20:'snowy', 21:'snowy', 22:'snowy', 23:'snowy',
    24:'snowy', 25:'snowy', 26:'snowy', 27:'snowy',
    28:'snowy', 29:'thunderstorm',
    30:'thunderstorm', 31:'thunderstorm', 32:'thunderstorm',
    33:'foggy', 34:'foggy', 35:'foggy', 36:'foggy',
    37:'foggy', 38:'foggy', 99:'sunny',
  }
  return mapping[code] || 'sunny'
}

function skyconCode(skycon) {
  const mapping = {
    'CLEAR_DAY':1, 'CLEAR_NIGHT':1,
    'PARTLY_CLOUDY_DAY':2, 'PARTLY_CLOUDY_NIGHT':2,
    'CLOUDY':3, 'CLOUDY_NIGHT':3,
    'OVERCAST':4,
    'FOG':5,
    'LIGHT_HAZE':5, 'MODERATE_HAZE':5, 'HEAVY_HAZE':5,
    'LIGHT_RAIN':8, 'MODERATE_RAIN':9, 'HEAVY_RAIN':10,
    'STORM_RAIN':10,
    'LIGHT_SNOW':20, 'MODERATE_SNOW':21, 'HEAVY_SNOW':22,
    'STORM_SNOW':22,
    'DRIZZLE':12,
    'THUNDERSTORM':29,
  }
  return mapping[skycon] || 0
}

function skyconToInfo(skycon) {
  const map = {
    'CLEAR_DAY':         { label:'Clear',          labelZh:'晴',        icon:'sunny' },
    'CLEAR_NIGHT':       { label:'Clear',          labelZh:'晴',        icon:'sunny' },
    'PARTLY_CLOUDY_DAY': { label:'Partly cloudy',  labelZh:'多云',      icon:'partly-cloudy' },
    'PARTLY_CLOUDY_NIGHT':{ label:'Partly cloudy', labelZh:'多云',      icon:'partly-cloudy' },
    'CLOUDY':            { label:'Cloudy',          labelZh:'阴',        icon:'cloudy' },
    'CLOUDY_NIGHT':      { label:'Cloudy',          labelZh:'阴',        icon:'cloudy' },
    'OVERCAST':          { label:'Overcast',         labelZh:'阴',        icon:'cloudy' },
    'FOG':               { label:'Fog',              labelZh:'雾',        icon:'foggy' },
    'LIGHT_HAZE':        { label:'Haze',            labelZh:'轻度雾霾',  icon:'foggy' },
    'MODERATE_HAZE':     { label:'Haze',            labelZh:'中度雾霾',  icon:'foggy' },
    'HEAVY_HAZE':        { label:'Haze',            labelZh:'重度雾霾',  icon:'foggy' },
    'LIGHT_RAIN':        { label:'Light rain',       labelZh:'小雨',     icon:'rainy' },
    'MODERATE_RAIN':     { label:'Rain',             labelZh:'中雨',     icon:'rainy' },
    'HEAVY_RAIN':        { label:'Heavy rain',       labelZh:'大雨',     icon:'rainy' },
    'STORM_RAIN':        { label:'Storm',            labelZh:'暴雨',     icon:'thunderstorm' },
    'LIGHT_SNOW':        { label:'Light snow',       labelZh:'小雪',     icon:'snowy' },
    'MODERATE_SNOW':     { label:'Snow',             labelZh:'中雪',     icon:'snowy' },
    'HEAVY_SNOW':        { label:'Heavy snow',       labelZh:'大雪',     icon:'snowy' },
    'STORM_SNOW':        { label:'Snowstorm',        labelZh:'暴雪',     icon:'snowy' },
    'DRIZZLE':           { label:'Drizzle',           labelZh:'毛毛雨',   icon:'drizzle' },
    'THUNDERSTORM':      { label:'Thunderstorm',     labelZh:'雷暴',     icon:'thunderstorm' },
  }
  return map[skycon] || { label:'Unknown', labelZh:'未知', icon:'sunny' }
}

// ── Fetch weather by configured provider ──────────────────────────────────────

async function fetchByProvider(provider, coords, city, country, key) {
  switch (provider) {
    case 'qweather':
      return fetchQWeather(coords, city, country, key)
    case 'openweathermap':
      return fetchOpenWeatherMap(coords, city, country, key)
    case 'caiyun':
      return fetchCaiyun(coords, city, country, key)
    case 'open-meteo':
    default:
      return fetchOpenMeteo(coords, city, country)
  }
}

// ── Cache helpers ────────────────────────────────────────────────────────────

async function loadCache() {
  try {
    const result = await chrome.storage.local.get([WEATHER_KEY, WEATHER_CITY_KEY])
    _cachedWeather = result[WEATHER_KEY] || null
    _cachedCity    = result[WEATHER_CITY_KEY] || null
  } catch {
    _cachedWeather = null
    _cachedCity    = null
  }
}

function isCacheValid() {
  if (!_cachedWeather) return false
  return Date.now() - _cachedWeather.time < CACHE_TTL
}

function setCache(data) {
  chrome.storage.local.set({ [WEATHER_KEY]: data }).catch(() => {})
}

function clearCache() {
  chrome.storage.local.remove(WEATHER_KEY).catch(() => {})
}

function saveCity(city) {
  if (city) {
    chrome.storage.local.set({ [WEATHER_CITY_KEY]: city }).catch(() => {})
  } else {
    chrome.storage.local.remove(WEATHER_CITY_KEY).catch(() => {})
  }
}

// ── Render UI ────────────────────────────────────────────────────────────────

function renderEmpty() {
  const container = document.getElementById('weatherWidget')
  if (!container) return
  // 清理 modal-open（加载失败后 corner-panel 应正常显示）
  document.body.classList.remove('modal-open')
  container.innerHTML = `
    <button class="weather-get-btn" id="weatherGetBtn">
      ${WEATHER_ICONS['location-pin']}
      <span>获取天气</span>
    </button>
  `
  container.style.display = 'flex'
  document.getElementById('weatherGetBtn')?.addEventListener('click', showWeatherOptions)
}

function renderLoading(message = '获取中...') {
  const container = document.getElementById('weatherWidget')
  if (!container) return
  // 防止 corner-panel 在加载期间闪现（modal 关闭后加载还未完成时会暴露 corner-panel）
  document.body.classList.add('modal-open')
  container.innerHTML = `
    <div class="weather-loading">
      <span class="weather-loading-icon">${WEATHER_ICONS['loading']}</span>
      <span class="weather-loading-text">${message}</span>
    </div>
  `
  container.style.display = 'flex'
}

function render(data) {
  const container = document.getElementById('weatherWidget')
  if (!container) return
  if (!data) { renderEmpty(); return }

  const lang          = getLang() || 'zh'
  const iconSvg       = WEATHER_ICONS[data.icon] || WEATHER_ICONS.sunny
  const conditionText = lang === 'en' ? data.label : data.labelZh
  const cityText      = data.city || ''

  // 计算数据新鲜度提示
  const dataAge = Math.floor((Date.now() - data.time) / 60000) // 分钟
  const ageHint = dataAge < 1 ? '' : `(${dataAge}${lang === 'zh' ? '分钟前' : 'min ago'})`

  container.innerHTML = `
    <div class="weather-display">
      <div class="weather-icon">${iconSvg}</div>
      <div class="weather-info">
        <span class="weather-temp">${data.temp}°</span>
        <span class="weather-condition">${conditionText}</span>
        ${cityText ? `<span class="weather-city">${cityText}</span>` : ''}
      </div>
      <div class="weather-actions">
        <button class="weather-refresh-btn" id="weatherRefreshBtn" title="${lang === 'zh' ? '刷新天气' : 'Refresh'}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
        <button class="weather-settings-btn" id="weatherSettingsBtn" title="${lang === 'zh' ? '更改位置' : 'Change location'}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
      </div>
    </div>
  `
  container.style.display = 'flex'
  document.getElementById('weatherSettingsBtn')?.addEventListener('click', showWeatherOptions)
  document.getElementById('weatherRefreshBtn')?.addEventListener('click', () => refreshWeatherManually(true))
  // 渲染完成后清理 modal-open，确保 corner-panel 可见
  document.body.classList.remove('modal-open')
}

// ── Weather options modal ─────────────────────────────────────────────────────

function showWeatherOptions() {
  const existing = document.getElementById('weatherOptionsModal')
  if (existing) existing.remove()

  const lang = getLang() || 'zh'

  const modal = document.createElement('div')
  modal.id = 'weatherOptionsModal'
  modal.className = 'weather-modal-overlay'
  modal.innerHTML = `
    <div class="weather-modal">
      <div class="weather-modal-header">
        <h3>${lang === 'zh' ? '获取天气信息' : 'Get Weather'}</h3>
        <button class="weather-modal-close" id="weatherModalClose">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="weather-modal-body">
        <p class="weather-modal-desc">${lang === 'zh' ? '选择获取天气的方式：' : 'Choose how to get weather:'}</p>
        <div class="weather-options">
          <button class="weather-option-btn" id="weatherOptionLocation">
            <span class="weather-option-icon">${WEATHER_ICONS['location-pin']}</span>
            <span class="weather-option-text">
              <strong>${lang === 'zh' ? '自动定位' : 'Auto Location'}</strong>
              <small>${lang === 'zh' ? '使用浏览器定位获取当前位置天气' : 'Use browser geolocation'}</small>
            </span>
          </button>
          <button class="weather-option-btn" id="weatherOptionCity">
            <span class="weather-option-icon">${WEATHER_ICONS['city-building']}</span>
            <span class="weather-option-text">
              <strong>${lang === 'zh' ? '手动输入城市' : 'Enter City'}</strong>
              <small>${lang === 'zh' ? '输入城市名称获取天气（如：北京、上海）' : 'Type city name (e.g., Beijing)'}</small>
            </span>
          </button>
        </div>
        <div class="weather-city-input" id="weatherCityInput" style="display:none">
          <input type="text" id="weatherCityField" placeholder="${lang === 'zh' ? '输入城市名称...' : 'Enter city name...'}" />
          <button id="weatherCitySubmit">${lang === 'zh' ? '确认' : 'OK'}</button>
        </div>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  const closeModal = () => modal.remove()
  document.getElementById('weatherModalClose')?.addEventListener('click', closeModal)
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal() })

  document.getElementById('weatherOptionLocation')?.addEventListener('click', () => {
    closeModal()
    requestLocation()
  })

  document.getElementById('weatherOptionCity')?.addEventListener('click', () => {
    document.getElementById('weatherCityInput').style.display = 'flex'
    document.getElementById('weatherCityField')?.focus()
  })

  const submitCity = async () => {
    const city = document.getElementById('weatherCityField')?.value?.trim()
    if (!city) return
    closeModal()
    renderLoading(lang === 'zh' ? '搜索城市中...' : 'Searching city...')
    try {
      const coords = await geocodeCity(city)
      if (!coords) throw new Error('City not found')
      saveCity(coords.city)
      await fetchAndRender(coords)
    } catch {
      alert(lang === 'zh' ? '未找到该城市，请检查拼写或网络' : 'City not found, check spelling or network')
      renderEmpty()
    }
  }

  document.getElementById('weatherCitySubmit')?.addEventListener('click', submitCity)
  document.getElementById('weatherCityField')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitCity()
  })
}

// ── Location ────────────────────────────────────────────────────────────────

async function requestLocation() {
  const lang = getLang() || 'zh'
  if (!navigator.geolocation) {
    alert(lang === 'zh' ? '您的浏览器不支持定位功能' : 'Geolocation not supported')
    return
  }
  renderLoading(lang === 'zh' ? '定位中...' : 'Locating...')
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      saveCity(null)
      const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude, city: null }
      await fetchAndRender(coords)
    },
    async () => {
      if (await tryDefaultCity()) return
      alert(lang === 'zh' ? '定位失败，请尝试手动输入城市' : 'Location failed')
      renderEmpty()
    },
    { timeout: 5000, maximumAge: CACHE_TTL }
  )
}

// ── Core fetch + render ──────────────────────────────────────────────────────

async function fetchAndRender(coords) {
  const settings  = getSettings()
  const provider  = settings.weatherProvider || 'open-meteo'
  const keyMap    = {
    qweather:       settings.weatherQweatherKey  || '',
    openweathermap: settings.weatherOwmKey      || '',
    caiyun:         settings.weatherCaiyunKey    || '',
  }
  const key       = keyMap[provider] || ''

  let data
  if (provider !== 'open-meteo' && !key) {
    // Provider selected but no key — fall back to Open-Meteo
    data = await fetchOpenMeteo(coords, coords.city || null, null)
  } else {
    data = await fetchByProvider(provider, coords, coords.city || null, null, key)
  }

  _cachedWeather = data
  setCache(data)
  render(data)
}

// ── Init ─────────────────────────────────────────────────────────────────────

export async function initWeather() {
  const container = document.getElementById('weatherWidget')
  if (!container) return

  await loadCache()
  const savedCity = _cachedCity

  // 优先使用有效缓存，避免每次刷新都请求 API
  if (isCacheValid() && _cachedWeather) {
    render(_cachedWeather)
    // 后台静默刷新（超过 20 分钟的旧数据才触发）
    if (_cachedWeather?.coords && Date.now() - _cachedWeather.time > 20 * 60 * 1000) {
      fetchAndRender(_cachedWeather.coords).catch(() => {})
    }
    return
  }

  if (savedCity) {
    renderLoading(getLang() === 'zh' ? '获取天气中...' : 'Loading...')
    try {
      const coords = await geocodeCity(savedCity)
      if (coords) {
        coords.city = savedCity
        await fetchAndRender(coords)
        return
      }
    } catch {
      // geocode failed, fall through to default
    }
  }

  // Try browser geolocation as first fallback
  if (await tryGeolocation()) return

  // Try random default city as second fallback
  if (await tryDefaultCity()) return

  // All fallbacks failed — show empty state
  renderEmpty()

  // Track dynamically-created modals (e.g., weatherOptionsModal) via MutationObserver
  // so the corner-panel hides whenever any modal is open
  if (!document._weatherModalObserver) {
    document._weatherModalObserver = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.id && /Modal$/i.test(node.id)) {
            document.body.classList.add('modal-open')
          }
        }
        for (const node of mut.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.id && /Modal$/i.test(node.id)) {
            // Only remove if no other modal-like elements remain in body
            const stillOpen = document.body.querySelector('[id$="Modal"]')
            if (!stillOpen) {
              document.body.classList.remove('modal-open')
            }
          }
        }
      }
    })
    document._weatherModalObserver.observe(document.body, { childList: true, subtree: false })
  }
}

async function tryGeolocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(false); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude, city: null }
          await fetchAndRender(coords)
          resolve(true)
        } catch {
          resolve(false)
        }
      },
      () => resolve(false),
      { timeout: 5000, maximumAge: 30 * 60 * 1000 }
    )
  })
}

async function tryDefaultCity() {
  const lang = getLang() || 'zh'
  renderLoading(lang === 'zh' ? '获取天气中...' : 'Loading...')
  // Pick a random default city to distribute load
  const defaultCity = DEFAULT_CITIES[Math.floor(Math.random() * DEFAULT_CITIES.length)]
  try {
    await fetchAndRender({
      lat: defaultCity.lat,
      lon: defaultCity.lon,
      city: defaultCity.name,
    })
    return true
  } catch {
    return false
  }
}

export async function refreshWeatherManually(fromButton = false) {
  // 如果是从按钮触发的，检查冷却时间
  if (fromButton) {
    const now = Date.now()
    const timeSinceLastRefresh = now - _lastManualRefresh
    if (timeSinceLastRefresh < REFRESH_COOLDOWN) {
      const remainingSeconds = Math.ceil((REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000)
      const lang = getLang() || 'zh'
      showToast(lang === 'zh'
        ? `⏱️ 刷新太频繁了，请 ${remainingSeconds} 秒后再试`
        : `⏱️ Too fast! Please wait ${remainingSeconds}s`)
      return
    }
    _lastManualRefresh = now
  }

  clearCache()
  await initWeather()
}

// ── Event listeners for settings changes ────────────────────────────────────

document.addEventListener('weather:provider-changed', async () => {
  clearCache()
  await initWeather()
})

document.addEventListener('weather:apikey-changed', async () => {
  clearCache()
  await initWeather()
})

// Re-render weather when language changes (condition label zh/en)
document.addEventListener('tabnest-lang-change', () => {
  if (_cachedWeather) {
    render(_cachedWeather)
  }
})
