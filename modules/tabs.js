/**
 * tabs.js — Chrome Tab API wrapper
 */

import {
  addRecentlyClosed,
} from './storage.js'

let _openTabs = []
let _extensionId = null

export async function fetchOpenTabs() {
  try {
    _extensionId = chrome.runtime.id
    const newtabUrl = `chrome-extension://${_extensionId}/index.html`
    const tabs = await chrome.tabs.query({})
    _openTabs = tabs.map(t => ({
      id:       t.id,
      url:      t.url,
      title:    t.title,
      windowId: t.windowId,
      active:   t.active,
      favIconUrl: t.favIconUrl,
      isSelfNewTab: t.url === newtabUrl || t.url === 'chrome://newtab/',
    }))
  } catch {
    _openTabs = []
  }
}

export function getOpenTabs() {
  return _openTabs
}

/** Returns only real web tabs (no chrome://, extension://, etc.) */
export function getRealTabs() {
  return _openTabs.filter(t => {
    const url = t.url || ''
    return (
      !url.startsWith('chrome://') &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('about:') &&
      !url.startsWith('edge://') &&
      !url.startsWith('brave://')
    )
  })
}

/** Close tabs by exact URL match */
export async function closeTabsExact(urls) {
  if (!urls?.length) return
  const urlSet = new Set(urls)
  const all = await chrome.tabs.query({})
  const toClose = all.filter(t => urlSet.has(t.url))
  // Save to recently closed before closing
  for (const tab of toClose) {
    await addRecentlyClosed({ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl })
  }
  const ids = toClose.map(t => t.id)
  if (ids.length) await chrome.tabs.remove(ids)
  await fetchOpenTabs()
}

/** Close tabs by hostname — use closeTabsExact when possible */
export async function closeTabsByUrls(urls) {
  if (!urls?.length) return
  const hostnames = []
  const exactUrls = new Set()
  for (const u of urls) {
    if (u.startsWith('file://')) {
      exactUrls.add(u)
    } else {
      try { hostnames.push(new URL(u).hostname) } catch {}
    }
  }
  const all = await chrome.tabs.query({})
  const toClose = all.filter(tab => {
    const tu = tab.url || ''
    if (tu.startsWith('file://') && exactUrls.has(tu)) return true
    try {
      const th = new URL(tu).hostname
      return th && hostnames.includes(th)
    } catch { return false }
  })
  for (const tab of toClose) {
    await addRecentlyClosed({ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl })
  }
  const ids = toClose.map(t => t.id)
  if (ids.length) await chrome.tabs.remove(ids)
  await fetchOpenTabs()
}

/** Close all tabs whose URL is in the given list (exact match — safest) */
export async function closeTabsByExactUrl(urls) {
  if (!urls?.length) return
  const all = await chrome.tabs.query({})
  const toClose = all.filter(t => urls.includes(t.url))
  for (const tab of toClose) {
    await addRecentlyClosed({ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl })
  }
  const ids = toClose.map(t => t.id)
  if (ids.length) await chrome.tabs.remove(ids)
  await fetchOpenTabs()
}

/** Focus (switch to) a tab by URL */
export async function focusTab(url) {
  if (!url) return
  const all = await chrome.tabs.query({})
  const currentWindow = await chrome.windows.getCurrent()
  let matches = all.filter(t => t.url === url)
  if (!matches.length) {
    try {
      const host = new URL(url).hostname
      matches = all.filter(t => {
        try { return new URL(t.url).hostname === host } catch { return false }
      })
    } catch {}
  }
  if (!matches.length) return
  const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0]
  await chrome.tabs.update(match.id, { active: true })
  await chrome.windows.update(match.windowId, { focused: true })
}

/** Close duplicate tabs, optionally keeping one */
export async function closeDuplicateTabs(urls, keepOne = true) {
  const all = await chrome.tabs.query({})
  const toClose = []
  for (const url of urls) {
    const matching = all.filter(t => t.url === url)
    if (keepOne) {
      const keep = matching.find(t => t.active) || matching[0]
      for (const tab of matching) {
        if (tab.id !== keep.id) toClose.push(tab)
      }
    } else {
      for (const tab of matching) toClose.push(tab)
    }
  }
  for (const tab of toClose) {
    await addRecentlyClosed({ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl })
  }
  if (toClose.length) await chrome.tabs.remove(toClose.map(t => t.id))
  await fetchOpenTabs()
}

/** Close extra TabNest new-tab pages */
export async function closeSelfDupes() {
  const extId = chrome.runtime.id
  const newtabUrl = `chrome-extension://${extId}/index.html`
  const all = await chrome.tabs.query({})
  const currentWindow = await chrome.windows.getCurrent()
  const selfTabs = all.filter(t => t.url === newtabUrl || t.url === 'chrome://newtab/')
  if (selfTabs.length <= 1) return
  const keep =
    selfTabs.find(t => t.active && t.windowId === currentWindow.id) ||
    selfTabs.find(t => t.active) ||
    selfTabs[0]
  const toClose = selfTabs.filter(t => t.id !== keep.id)
  for (const tab of toClose) {
    await addRecentlyClosed({ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl })
  }
  if (toClose.length) await chrome.tabs.remove(toClose.map(t => t.id))
  await fetchOpenTabs()
}

/** Reopen a recently closed tab (creates a new tab) */
export async function reopenTab(tabInfo) {
  if (!tabInfo?.url) return
  await chrome.tabs.create({ url: tabInfo.url, active: false })
}
