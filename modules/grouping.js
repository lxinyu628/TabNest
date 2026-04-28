/**
 * grouping.js — Tab grouping logic (landing pages, domain, custom groups)
 */

// ── Default landing page patterns ────────────────────────────
const LANDING_PAGE_PATTERNS = [
  { hostname: 'mail.google.com',  test: (p) => !p.includes('#inbox/') && !p.includes('#sent/') && !p.includes('#search/') },
  { hostname: 'x.com',           pathExact: ['/home'] },
  { hostname: 'www.linkedin.com', pathExact: ['/'] },
  { hostname: 'github.com',      pathExact: ['/'] },
  { hostname: 'www.youtube.com',  pathExact: ['/'] },
]

// ── Custom config (can be overridden by config.local.js) ─────
const CUSTOM_GROUPS = typeof LOCAL_CUSTOM_GROUPS !== 'undefined' ? LOCAL_CUSTOM_GROUPS : []
const LOCAL_LANDING_PATTERNS = typeof LOCAL_LANDING_PAGE_PATTERNS !== 'undefined' ? LOCAL_LANDING_PAGE_PATTERNS : []

const ALL_LANDING_PATTERNS = [...LANDING_PAGE_PATTERNS, ...LOCAL_LANDING_PATTERNS]

// ── Friendly domain display names ────────────────────────────
const FRIENDLY_DOMAINS = {
  'github.com':            'GitHub',
  'www.github.com':        'GitHub',
  'gist.github.com':       'GitHub Gist',
  'youtube.com':           'YouTube',
  'www.youtube.com':       'YouTube',
  'music.youtube.com':     'YouTube Music',
  'x.com':                 'X',
  'www.x.com':            'X',
  'twitter.com':           'X',
  'www.twitter.com':       'X',
  'reddit.com':            'Reddit',
  'www.reddit.com':        'Reddit',
  'old.reddit.com':        'Reddit',
  'substack.com':          'Substack',
  'www.substack.com':      'Substack',
  'medium.com':            'Medium',
  'www.medium.com':        'Medium',
  'linkedin.com':          'LinkedIn',
  'www.linkedin.com':      'LinkedIn',
  'stackoverflow.com':    'Stack Overflow',
  'news.ycombinator.com': 'Hacker News',
  'google.com':            'Google',
  'www.google.com':        'Google',
  'mail.google.com':       'Gmail',
  'docs.google.com':       'Google Docs',
  'drive.google.com':      'Google Drive',
  'calendar.google.com':   'Google Calendar',
  'gemini.google.com':     'Gemini',
  'chatgpt.com':           'ChatGPT',
  'www.chatgpt.com':       'ChatGPT',
  'claude.ai':             'Claude',
  'www.claude.ai':         'Claude',
  'notion.so':             'Notion',
  'www.notion.so':         'Notion',
  'figma.com':             'Figma',
  'www.figma.com':         'Figma',
  'slack.com':             'Slack',
  'discord.com':           'Discord',
  'vercel.com':            'Vercel',
  'npmjs.com':             'npm',
  'wikipedia.org':         'Wikipedia',
  'arxiv.org':             'arXiv',
  'huggingface.co':        'Hugging Face',
  'local-files':           'Local Files',
}

// ── Helpers ─────────────────────────────────────────────────
function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function friendlyDomain(hostname) {
  if (!hostname) return ''
  if (FRIENDLY_DOMAINS[hostname]) return FRIENDLY_DOMAINS[hostname]
  // Substack author pages
  if (hostname.endsWith('.substack.com') && hostname !== 'substack.com') {
    return capitalize(hostname.replace('.substack.com', '')) + "'s Substack"
  }
  // GitHub Pages
  if (hostname.endsWith('.github.io')) {
    return capitalize(hostname.replace('.github.io', '')) + ' (GitHub Pages)'
  }
  // Generic: strip common TLDs and capitalize
  let clean = hostname
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk)$/, '')
  return clean.split('.').map(part => capitalize(part)).join(' ')
}

export function stripTitleNoise(title) {
  if (!title) return ''
  title = title.replace(/^\(\d+\+?\)\s*/, '')
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ')
  title = title.replace(/\s*[\-\u2010-\u2015]\s*[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '')
  title = title.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '')
  title = title.replace(/\s+on X:\s*/, ': ')
  title = title.replace(/\s*\/\s*X\s*$/, '')
  return title.trim()
}

export function smartTitle(title, url) {
  if (!url) return title || ''
  let pathname = '', hostname = ''
  try { const u = new URL(url); pathname = u.pathname; hostname = u.hostname }
  catch { return title || '' }

  const titleIsUrl = !title || title === url || title.startsWith(hostname) || title.startsWith('http')

  if ((hostname === 'x.com' || hostname === 'twitter.com') && pathname.includes('/status/')) {
    const username = pathname.split('/')[1]
    if (username) return titleIsUrl ? `Post by @${username}` : title
  }

  if (hostname === 'github.com' || hostname === 'www.github.com') {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      const [owner, repo, ...rest] = parts
      if (rest[0] === 'issues' && rest[1]) return `${owner}/${repo} Issue #${rest[1]}`
      if (rest[0] === 'pull'   && rest[1]) return `${owner}/${repo} PR #${rest[1]}`
      if (rest[0] === 'blob' || rest[0] === 'tree') return `${owner}/${repo} — ${rest.slice(2).join('/')}`
      if (titleIsUrl) return `${owner}/${repo}`
    }
  }

  if (hostname === 'www.youtube.com' || hostname === 'youtube.com') {
    if (pathname === '/watch' && titleIsUrl) return 'YouTube Video'
  }

  if ((hostname === 'www.reddit.com' || hostname === 'reddit.com') && pathname.includes('/comments/')) {
    const parts = pathname.split('/').filter(Boolean)
    const subIdx = parts.indexOf('r')
    if (subIdx !== -1 && parts[subIdx + 1] && titleIsUrl) return `r/${parts[subIdx + 1]} post`
  }

  return title || url
}

export function cleanTitle(title, hostname) {
  if (!title || !hostname) return title || ''
  const friendly = friendlyDomain(hostname)
  const domain   = hostname.replace(/^www\./, '')
  const seps     = [' - ', ' | ', ' — ', ' · ', ' – ']
  for (const sep of seps) {
    const idx = title.lastIndexOf(sep)
    if (idx === -1) continue
    const suffix = title.slice(idx + sep.length).trim()
    const suffixLow = suffix.toLowerCase()
    if (
      suffixLow === domain.toLowerCase() ||
      suffixLow === friendly.toLowerCase() ||
      suffixLow === domain.replace(/\.\w+$/, '').toLowerCase() ||
      domain.toLowerCase().includes(suffixLow) ||
      friendly.toLowerCase().includes(suffixLow)
    ) {
      const cleaned = title.slice(0, idx).trim()
      if (cleaned.length >= 5) return cleaned
    }
  }
  return title
}

// ── Landing page detection ────────────────────────────────────
function isLandingPage(url) {
  try {
    const parsed = new URL(url)
    return ALL_LANDING_PATTERNS.some(p => {
      const hostnameMatch = p.hostname
        ? parsed.hostname === p.hostname
        : p.hostnameEndsWith
          ? parsed.hostname.endsWith(p.hostnameEndsWith)
          : false
      if (!hostnameMatch) return false
      if (p.test) return p.test(parsed.pathname, url)
      if (p.pathPrefix) return parsed.pathname.startsWith(p.pathPrefix)
      if (p.pathExact)  return p.pathExact.includes(parsed.pathname)
      return parsed.pathname === '/'
    })
  } catch { return false }
}

// ── Custom group matching ─────────────────────────────────────
function matchCustomGroup(url) {
  try {
    const parsed = new URL(url)
    return CUSTOM_GROUPS.find(r => {
      const hostMatch = r.hostname
        ? parsed.hostname === r.hostname
        : r.hostnameEndsWith
          ? parsed.hostname.endsWith(r.hostnameEndsWith)
          : false
      if (!hostMatch) return false
      if (r.pathPrefix) return parsed.pathname.startsWith(r.pathPrefix)
      return true
    }) || null
  } catch { return null }
}

// ── Main grouping function ───────────────────────────────────
export function groupTabs(tabs) {
  const groupMap = {}
  const landingTabs = []

  for (const tab of tabs) {
    try {
      if (isLandingPage(tab.url)) {
        landingTabs.push(tab)
        continue
      }

      const rule = matchCustomGroup(tab.url)
      if (rule) {
        const key = rule.groupKey
        if (!groupMap[key]) groupMap[key] = { domain: key, label: rule.groupLabel, tabs: [] }
        groupMap[key].tabs.push(tab)
        continue
      }

      let hostname
      if (tab.url && tab.url.startsWith('file://')) {
        hostname = 'local-files'
      } else {
        hostname = new URL(tab.url).hostname
      }
      if (!hostname) continue
      if (!groupMap[hostname]) groupMap[hostname] = { domain: hostname, tabs: [] }
      groupMap[hostname].tabs.push(tab)
    } catch {}
  }

  if (landingTabs.length) {
    groupMap['__landing-pages__'] = { domain: '__landing-pages__', tabs: landingTabs }
  }

  // Sort: landing pages first, then priority domains, then by tab count
  const landingHostnames = new Set(ALL_LANDING_PATTERNS.map(p => p.hostname).filter(Boolean))
  const landingSuffixes  = ALL_LANDING_PATTERNS.map(p => p.hostnameEndsWith).filter(Boolean)

  function isLandingDomain(domain) {
    if (landingHostnames.has(domain)) return true
    return landingSuffixes.some(s => domain.endsWith(s))
  }

  return Object.values(groupMap).sort((a, b) => {
    const aL = a.domain === '__landing-pages__'
    const bL = b.domain === '__landing-pages__'
    if (aL !== bL) return aL ? -1 : 1
    const aP = isLandingDomain(a.domain)
    const bP = isLandingDomain(b.domain)
    if (aP !== bP) return aP ? -1 : 1
    return b.tabs.length - a.tabs.length
  })
}
