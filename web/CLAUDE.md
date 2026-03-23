# Clippo Web

Web platform for the Clippo Chrome extension - save and organize your favorite YouTube moments.

**Live site:** [clippo.app](https://clippo.app)

## Structure

```
clippo-web/
├── index.html          # Landing page with header (login/logout state)
├── auth/
│   ├── index.html      # Login/Signup page (Supabase auth)
│   └── logout/
│       └── index.html  # Logout page (clears session)
├── archive/
│   └── index.html      # Archive gateway (connects to Chrome extension)
├── player/
│   └── index.html      # YouTube embed player for clips
├── CLAUDE.md           # Project documentation
├── package.json        # Project config
└── vercel.json         # Vercel deployment config
```

## Pages

### Landing Page (`/`)
- Hero section with Clippo branding
- Feature cards (Clip, Organize, Sync)
- CTA section with Chrome Web Store download link
- Header with login/logout state
- Shows "Archive" link when logged in

### Auth Page (`/auth/`)
- Login and Sign Up tabs
- Supabase email/password authentication
- Redirects to archive on success
- Stores user ID and email in localStorage

### Logout Page (`/auth/logout/`)
- Clears Supabase session via `supabase.auth.signOut()`
- Removes localStorage data (clippo_user_id, clippo_user_email)
- Shows "Logged out successfully" message
- Redirects to homepage after 1 second
- Used by Chrome extension to sync logout state

### Archive Page (`/archive/`)
- Gateway to the Chrome extension's archive
- Checks authentication (localStorage + Supabase session)
- Communicates with extension via `chrome.runtime.sendMessage`
- Opens extension's archive.html when connected

### Player Page (`/player/`)
- Embed player for YouTube video clips
- URL format: `/player/?v=VIDEO_ID&start=SECONDS&end=SECONDS`
- Full-screen YouTube embed (100vw x 100vh)
- Auto-starts from the `start` timestamp
- Shows time range overlay on hover (when `end` is provided)
- Visual range indicator bar at the bottom
- Used by the Chrome extension for clip playback in modals/iframes

**Example:**
```
https://clippo.app/player/?v=dQw4w9WgXcQ&start=10&end=30
```

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS
- **Auth:** Supabase (email/password)
- **Hosting:** Vercel (auto-deploy from GitHub)
- **Fonts:** Sora + Space Mono

## Supabase Configuration

- **URL:** `https://phnfwoqyyqnqmmteygnb.supabase.co`
- **Database Tables:**
  - `clips` - User's saved video clips
  - `categories` - Clip categories
  - `macro_categories` - Category groups

## Chrome Extension Integration

The web archive page communicates with the Clippo Chrome extension:

**Chrome Web Store:** [Clippo Extension](https://chromewebstore.google.com/detail/clippo/dffdbdjjppbfkejaaeeglflebiepofed)

**Extension ID:** `dffdbdjjppbfkejaaeeglflebiepofed`

### Required Extension Changes

1. Add to `manifest.json`:
```json
"externally_connectable": {
  "matches": [
    "https://clippo.app/*",
    "https://*.clippo.app/*"
  ]
}
```

2. Add to `background.js`:
```javascript
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    if (request.action === 'openArchive') {
      if (request.userId) {
        chrome.storage.local.set({
          clippo_user_id: request.userId,
          clippo_user_email: request.userEmail || ''
        }, () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') });
          sendResponse({ success: true });
        });
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') });
        sendResponse({ success: true });
      }
      return true;
    }
    sendResponse({ success: false });
    return false;
  }
);
```

## Branding

- **Logo Horizontal:** `https://phnfwoqyyqnqmmteygnb.supabase.co/storage/v1/object/public/assets/clippo_logo_h.png`
- **Icon (light bg):** `https://phnfwoqyyqnqmmteygnb.supabase.co/storage/v1/object/public/assets/icon_48.png`
- **Icon (dark/red bg):** `https://phnfwoqyyqnqmmteygnb.supabase.co/storage/v1/object/public/assets/icon_48_n.png`
- **Primary Color:** `#ed1c24` (red)
- **Dark Color:** `#c41920`
- **Light Color:** `#ff3b42`
- **Fonts:**
  - Zain (all UI elements)
  - Titles use font-weight: 800 (extrabold)

## localStorage Keys

```javascript
clippo_user_id      // User's Supabase UUID
clippo_user_email   // User's email address
```

## Development

```bash
# Install dependencies (optional, for local server)
npm install

# Run local server
npx serve .
```

## Deployment

Automatically deployed to Vercel on push to `main` branch.

GitHub → Vercel (auto-deploy)
