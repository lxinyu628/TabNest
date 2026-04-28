# AGENTS.md — TabNest: Setup & Onboarding Guide for Coding Agents

You're setting up **TabNest** for the user. Your job is not just to set it up — it's to get them excited about using it.

---

## Step 0 — Introduce the product

Before doing anything technical, tell the user what they're about to get:

> **TabNest** replaces your new tab page with a clean dashboard of everything you have open, grouped by domain.
>
> Here's what makes it great:
> - **See all your open tabs at a glance** grouped by domain on a grid
> - **Homepages group** pulls Gmail, X, LinkedIn, YouTube, GitHub homepages into one card for easy cleanup
> - **Close tabs with style** satisfying swoosh sound + confetti burst
> - **Duplicate detection** flags when you have the same page open twice
> - **Click any tab title to jump to it** even across different Chrome windows
> - **Save for later** bookmark individual tabs to a checklist before closing them
> - **Light / Dark / System theme** toggle in the top-right corner
> - **100% local** no server, no accounts, no data sent anywhere
>
> It's a Chrome extension. Setup takes about 2 minutes.

---

## Step 1 — Get the project

The project should already be on your machine. Navigate to the project root directory in your terminal. If starting fresh:

```bash
# Clone the repository
git clone <your-repo-url>
cd organize-tab
```

---

## Step 2 — Build the extension

This step is new in v2 — the code is now built with Vite before loading.

**First**, install dependencies and build:
```bash
npm install
npm run build
```

The built extension will be in the `dist/` folder.

**Then**, print and copy the full path to `dist/`:
```bash
echo "Extension folder: $(cd dist && pwd)"
```

- macOS: `cd dist && pwd | pbcopy && echo "Path copied to clipboard"`
- Linux: `cd dist && pwd | xclip -selection clipboard 2>/dev/null || echo "Path: $(pwd)"`
- Windows: `cd dist && echo %CD% | clip`

**Then**, open the extensions page:
```bash
open "chrome://extensions"
```

**Then**, walk the user through it step by step:

> I've copied the extension folder path to your clipboard. Now:
>
> 1. You should see Chrome's extensions page. In the **top-right corner**, toggle on **Developer mode** (it's a switch).
> 2. Once Developer mode is on, you'll see a button called **"Load unpacked"** appear in the top-left. Click it.
> 3. A file picker will open. **Press Cmd+Shift+G** (Mac) or **Ctrl+L** (Windows/Linux) to open the "Go to folder" bar, then **paste** the path I copied (Cmd+V / Ctrl+V) and press Enter.
> 4. Click **"Select"** or **"Open"** and the extension will install.
>
> You should see "TabNest" appear in your extensions list.

**Also**, open the file browser directly to the dist folder as a fallback:
- macOS: `open dist/`
- Linux: `xdg-open dist/`
- Windows: `explorer dist\\`

---

## Step 3 — Show them around

Once the extension is loaded:

> You're all set! Open a **new tab** and you'll see TabNest.
>
> Here's how it works:
> 1. **Your open tabs are grouped by domain** in a grid layout.
> 2. **Homepages** (Gmail inbox, X home, YouTube, etc.) are in their own group at the top.
> 3. **Click any tab title** to jump directly to that tab.
> 4. **Click the X** next to any tab to close just that one (with swoosh + confetti).
> 5. **Click "Close all N tabs"** on a group to close the whole thing.
> 6. **Duplicate tabs** are flagged with an amber "(2x)" badge. Click "Close duplicates" to keep one copy.
> 7. **Save a tab for later** by clicking the bookmark icon before closing it. Saved tabs appear in the sidebar.
> 8. **Toggle theme** with the sun/moon icon in the top-right corner.
>
> That's it! No server to run. Everything works right away.

---

## Key Facts

- TabNest is a pure Chrome extension. No server, no Node.js (only needed for building).
- Saved tabs are stored in `chrome.storage.local` (persists across sessions).
- 100% local. No data is sent to any external service.
- To update: `git pull && npm install && npm run build`, then reload the extension in `chrome://extensions`.
- **Important:** After any code change, you must rebuild (`npm run build`) before reloading in Chrome.
