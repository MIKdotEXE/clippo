# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clippo is a Chrome Extension (Manifest V3) for saving and managing timestamped clips from YouTube videos. Users mark start/end timestamps on YouTube, organize clips into macro-categories and categories, and review them in an archive page.

## Development

**Load the extension in Chrome:**
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. After code changes, click the refresh icon on the extension card

**Test the widget:** Open any YouTube video (`youtube.com/watch?v=...`), then click the extension icon or press `Ctrl+Shift+Y`

**Test the archive:** Click the extension icon on any non-YouTube page, or click "Archive" in the widget

## Architecture

```
┌─────────────────┐     messages      ┌─────────────────┐
│   content.js    │◄────────────────►│  background.js  │
│  (YouTube page) │                   │ (Service Worker)│
└────────┬────────┘                   └────────┬────────┘
         │                                      │
         │ injects widget                       │ opens
         ▼                                      ▼
   YouTube DOM                          ┌─────────────────┐
                                        │  archive.html   │
                                        │  + archive.js   │
                                        └─────────────────┘
                                                │
                    ┌───────────────────────────┘
                    ▼
            chrome.storage.sync
            (clips, categories, macroCategories)
```

**background.js** — Service worker handling:
- Message routing (`saveClip`, `openArchive`)
- Extension icon click → injects content script or opens archive
- Keyboard shortcut (`Ctrl+Shift+Y`) → same logic

**content.js** — Injected on YouTube watch pages:
- Creates floating widget with Clippo brand theme
- Captures video timestamps via `video.currentTime`
- Manages macro/category autocomplete filtered by selection
- Sends clips to background for storage

**archive.html + archive.js** — Extension page for clip management:
- Collapsible sidebar with macro → category hierarchy
- Mosaic grid of category cards with custom icons
- Clip cards with thumbnail, popup video player (854x480)
- Edit/delete for clips and categories

## Data Storage (chrome.storage.sync)

```javascript
{
  clips: [
    { videoId, title, macro, cat, start, end }
  ],
  categories: [
    { name, icon, macro }  // icon is https:// URL or null
  ],
  macroCategories: ["Others", "Gaming", "Tutorials", ...]
}
```

"Others" is a reserved macro/category that cannot be renamed or deleted.

## UI Theme & Branding

Both widget and archive use Clippo brand theme:
- **Brand colors:** `#ed1c24` (primary red), `#c41920` (dark red), `#ffffff` (white)
- Colors defined in `COLORS` object (content.js) and CSS variables (archive.html, popup.html)
- Font: Zain (Google Web Font) for all UI elements
- Light theme with red accents and white backgrounds
- Logo hosted on Supabase: `https://phnfwoqyyqnqmmteygnb.supabase.co/storage/v1/object/public/assets/clippo_logo.png`
- Local icons in `images/` folder (icon_16.png, icon_48.png, icon_128.png, icon_256.png)

## Security Considerations

- User input (titles, category names) must use `textContent`, never `innerHTML`
- Icon URLs must validate `startsWith('https://')` before use
- CSP defined in manifest restricts scripts and image sources

## Authentication Flow

The extension uses Supabase for user authentication:

1. **Widget Auth** (content.js): When user opens widget on YouTube without being logged in, a login/signup form is shown directly in the widget
2. **Popup Auth** (popup.html): When clicking extension icon outside YouTube, opens a full auth page
3. **Storage**: Auth tokens stored in `chrome.storage.local`:
   - `clippo_user_id`
   - `clippo_user_email`
   - `clippo_access_token`
   - `clippo_refresh_token`

**Supabase Configuration:**
- URL: `https://phnfwoqyyqnqmmteygnb.supabase.co`
- Disable "Confirm email" in Authentication > Providers > Email for easier testing

## Web Platform (clippo.app)

**Tech Stack:**
- **Domain:** clippo.app
- **Hosting:** Vercel
- **Backend/Auth/DB:** Supabase (PostgreSQL + built-in auth)

**Benefits of web archive:**
- Cross-device clip synchronization
- Embedded YouTube player (bypasses extension Referer header restriction)
- User accounts and authentication

### Supabase Database Schema

```sql
-- Users table (handled by Supabase Auth)

-- Clips table
CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  macro TEXT NOT NULL DEFAULT 'Others',
  cat TEXT NOT NULL DEFAULT 'Others',
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,  -- https:// URL or null
  macro TEXT NOT NULL DEFAULT 'Others',
  UNIQUE(user_id, name)
);

-- Macro categories table
CREATE TABLE macro_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(user_id, name)
);

-- Row Level Security (RLS)
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE macro_categories ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can CRUD own clips" ON clips
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own categories" ON categories
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own macros" ON macro_categories
  FOR ALL USING (auth.uid() = user_id);
```

### Web Repository Structure (clippo-web)

```
clippo-web/
├── index.html           # Landing page (clippo.app)
├── auth/
│   ├── index.html       # Login/signup page
│   └── auth.js          # Authentication logic
├── archive/
│   ├── index.html       # Web archive with YouTube embeds
│   └── archive.js       # Supabase data loading + video modal
└── assets/
    └── icon.png         # Logo
```

**URL Routes:**
- `clippo.app/` → Landing page
- `clippo.app/auth/` → Login/signup
- `clippo.app/archive/` → Clip archive (requires auth)

### Supabase Setup

1. Create Supabase project at supabase.com
2. Run the SQL schema above in Supabase SQL editor
3. Enable Email/Password auth in Authentication > Providers
4. **Disable "Confirm email"** for easier testing
5. (Optional) Enable Google OAuth in Authentication > Providers

### Extension ↔ Web Sync Flow

1. User logs in via extension widget or popup
2. Auth tokens stored in `chrome.storage.local`
3. Extension syncs clips to Supabase on save
4. Web archive loads clips from Supabase
5. `chrome.storage.sync` serves as offline fallback

## Next Tasks (TODO)

1. ~~**Add logout button in archive page**~~ ✓ Done — Logout button in header

2. ~~**Remove "open in new tab" video behavior**~~ ✓ Done — Videos play inline in expandable cards

3. ~~**Redesign archive page with editable cards**~~ ✓ Done — New card design with:
   - Thumbnail with play overlay
   - Editable title, macro, category fields
   - Expandable video player
   - Filter tabs by macro

4. **Update clippo.app/player to stop at end time** — The player page needs to:
   - Use YouTube IFrame API (not just embed URL)
   - Monitor `player.getCurrentTime()` and pause when reaching `end`
   - Send `postMessage` to parent when clip ends:
     ```js
     window.parent.postMessage({ type: "videoEnded", clipId: clipId }, "*");
     ```
   - Accept new param: `clipId` (to identify which clip ended)
   - Example URL: `https://clippo.app/player/?v=dQw4w9WgXcQ&start=10&end=30&clipId=5`
