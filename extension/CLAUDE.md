# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Clippo is a Chrome Extension (Manifest V3) + web platform for saving and managing timestamped clips from YouTube videos. Users mark start/end timestamps on YouTube, organize clips into macro-categories and categories, and review them in an archive page.

**Monorepo structure:**
```
clippo/
├── extension/     # Chrome Extension (this folder)
├── web/           # Web platform (clippo.app, Vercel)
└── assets/        # Design files (not in git)
```

**GitHub:** github.com/MIKdotEXE/clippo
**Chrome Web Store:** https://chromewebstore.google.com/detail/clippo/dffdbdjjppbfkejaaeeglflebiepofed
**Web:** https://clippo.app (hosted on Vercel, auto-deploys from `web/` folder)

## Development

**Load the extension in Chrome:**
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` directory
4. After code changes, click the refresh icon on the extension card

**Test the widget:** Open any YouTube video, click the Clippo overlay icon on the video player, or press `Ctrl+Shift+Y`

**Test the archive:** Click the extension icon on any non-YouTube page, or click "Archive" in the widget

**Test the web:** Push to `main` branch — Vercel auto-deploys. Root Directory on Vercel is set to `web/`.

## Architecture

```
┌─────────────────┐     messages      ┌─────────────────┐
│   content.js    │◄────────────────►│  background.js  │
│  (YouTube page) │                   │ (Service Worker)│
└────────┬────────┘                   └────────┬────────┘
         │                                      │
         │ injects widget + overlay icon        │ opens
         ▼                                      ▼
   YouTube DOM                          ┌─────────────────┐
                                        │  archive.html   │
                                        │  + archive.js   │
                                        └─────────────────┘
                                        ┌─────────────────┐
                                        │  settings.html  │
                                        │  + settings.js  │
                                        └─────────────────┘
                                        ┌─────────────────┐
                                        │  popup.html     │
                                        │  + popup.js     │
                                        └─────────────────┘
```

### Extension Files

- **background.js** — Service worker: message routing, extension icon click, keyboard shortcut, Supabase sync, opens archive/settings
- **content.js** — Injected on YouTube watch pages: floating widget (auth + clip form), overlay icon on video player, video playback controls (-5s/+5s/play-pause), settings integration
- **archive.html + archive.js** — Clip management: sidebar with macro/category hierarchy, clip cards with inline video player, share button (Web Share API), settings gear icon
- **popup.html + popup.js** — Full-page auth (centered card layout): Google OAuth, email login/signup, opens as tab when clicking extension icon outside YouTube
- **settings.html + settings.js** — User settings: overlay toggle, auto-pause, playback controls, dark theme, username, change password, delete account request

### Web Files

- **web/index.html** — Landing page (clippo.app)
- **web/auth/index.html** — Login/signup with Google OAuth, forgot password, password reset handling
- **web/archive/** — Web archive gateway (connects to extension)
- **web/player/index.html** — Branded clip player landing page with rewatch overlay and Clippo branding/CTA
- **web/privacy/** — Privacy policy

## Data Storage

**chrome.storage.sync** (clips, categories):
```javascript
{
  clips: [{ videoId, title, macro, cat, start, end }],
  categories: [{ name, icon, macro }],
  macroCategories: ["Others", ...]
}
```

**chrome.storage.local** (auth + settings):
```javascript
{
  clippo_user_id, clippo_user_email,
  clippo_access_token, clippo_refresh_token,
  clippo_show_overlay: true,    // Show overlay icon on YouTube player
  clippo_autopause: false,      // Pause video on Set Start/End
  clippo_show_controls: true,   // Show -5s/play-pause/+5s buttons
  clippo_theme: 'light',        // 'light' or 'dark'
  clippo_username: ''            // User display name
}
```

## UI Theme & Branding

- **Brand colors:** `#ed1c24` (primary red), `#c41920` (dark red), `#ffffff` (white)
- **Font:** Zain (Google Web Font) for all UI elements
- **Logo:** Supabase storage: `clippo_logo.png`, `clippo_logo_h.png`, `icon_48.png`, `icon_48_n.png`
- **Dark theme:** Available in settings, applies to settings page and archive

## Authentication

- **Supabase Auth** — Email/password + Google OAuth
- **Supabase URL:** `https://phnfwoqyyqnqmmteygnb.supabase.co`
- **Auth flows:** Widget on YouTube, popup page, web auth page (clippo.app/auth)
- **Password reset:** Via clippo.app/auth → "Forgot password?" → Supabase resetPasswordForEmail
- **Google OAuth:** Button in widget, popup, and web auth page → redirects to clippo.app/auth/?google=1

**IMPORTANT Supabase config:**
- Site URL must be set to `https://clippo.app` (not localhost)
- Redirect URLs must include `https://clippo.app/auth/`

## Supabase Database Schema

```sql
-- clips (user_id, video_id, title, macro, cat, start_time, end_time, created_at)
-- categories (user_id, name, icon, macro) — UNIQUE(user_id, name)
-- macro_categories (user_id, name) — UNIQUE(user_id, name)
-- All tables have RLS: auth.uid() = user_id
```

## Security

- User input: always `textContent`, never `innerHTML` (except static HTML)
- Icon URLs: validate `startsWith('https://')` before use
- clipId in postMessage: sanitized with `replace(/[^\w-]/g, "")`
- Error messages: rendered via DOM API, not innerHTML
- CSP in manifest restricts scripts and image sources
- OAuth client secret: stored in `assets/` folder, NEVER committed to git

## TODO

### Pending
- Ads in archive page (need AdSense account first)
- Email confirmation on signup (Supabase dashboard config)
- Google OAuth provider setup (Supabase dashboard config)
- Check grafico generale (loghi, colori, consistenza UI)
- Logo Clippo corretto nel player page

### Completed
- Monorepo consolidation (VideoMark + videomark-web → clippo)
- Player stop at end time (YouTube IFrame API)
- Widget video controls (-5s, play/pause, +5s)
- Overlay icon on YouTube video player
- Share clips via Web Share API
- Password reset / forgot password
- Google OAuth button (widget, popup, web)
- Settings page (overlay, auto-pause, controls, theme, username, password, delete account)
- Settings accessible from widget gear icon and archive gear icon
- Popup redesign (centered card layout matching web auth)
- Pause video on archive open
- Branded shared clip player landing page
- Security audit + XSS fix
