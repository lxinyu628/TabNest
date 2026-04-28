/**
 * config.local.js — Personal configuration (gitignored)
 *
 * Copy this file to dist/config.local.js after building.
 * The extension loads it automatically if present.
 *
 * After running `npm run build`, copy this to dist/:
 *   cp extension/config.local.example.js dist/config.local.js
 */

// ── Custom landing page patterns ───────────────────────────────
// These are matched in addition to the built-in defaults (Gmail inbox,
// X home, LinkedIn home, GitHub home, YouTube home).
//
// Supported fields:
//   hostname        — exact hostname match
//   hostnameEndsWith — suffix match (e.g. ".github.com")
//   pathExact       — array of exact paths (e.g. ['/inbox', '/'])
//   pathPrefix      — string prefix match
//   test(pathname, fullUrl) — custom JS function
//
const LOCAL_LANDING_PAGE_PATTERNS = [
  // Example: Feedly unread
  // { hostname: 'feedly.com', pathExact: ['/v3/my'] },

  // Example: Notion daily notes
  // { hostname: 'notion.so', pathPrefix: '/workspace/daily' },
]

// ── Custom tab groups ───────────────────────────────────────────
// Group specific URLs together under a custom label.
//
// Example: all Linear inbox tabs grouped under "Linear Inbox"
// instead of spreading across team subdomains.
const LOCAL_CUSTOM_GROUPS = [
  // {
  //   hostname: 'linear.app',
  //   pathPrefix: '/inbox',
  //   groupKey: 'linear-inbox',
  //   groupLabel: 'Linear Inbox',
  // },
]
