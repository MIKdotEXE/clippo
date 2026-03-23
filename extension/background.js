// background.js — robust injection + toggleWidget on YouTube, openArchive, Supabase sync

// =============================================
// SUPABASE CONFIGURATION
// =============================================
const SUPABASE_URL = 'https://phnfwoqyyqnqmmteygnb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobmZ3b3F5eXFucW1tdGV5Z25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTQwNjQsImV4cCI6MjA4MjQzMDA2NH0.j_9AV-MeZXhRdlrn-O9mMdvgvokSXexUnKIS2r9mljc';
const WEB_ARCHIVE_URL = 'https://clippo.app/archive/';

// =============================================
// SUPABASE CLIENT (minimal implementation)
// =============================================
async function supabaseRequest(endpoint, options = {}) {
  // Get user's access token for authenticated requests
  const accessToken = await getAccessToken();
  const authToken = accessToken || SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Supabase error: ${response.status} - ${errorText}`);
  }

  return response;
}

// Get user ID from local storage (set by popup auth)
async function getUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['clippo_user_id'], (result) => {
      resolve(result.clippo_user_id || null);
    });
  });
}

// Get access token for authenticated requests
async function getAccessToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['clippo_access_token'], (result) => {
      resolve(result.clippo_access_token || null);
    });
  });
}

// Set user ID in local storage
async function setUserId(userId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ clippo_user_id: userId }, resolve);
  });
}

// =============================================
// SAVE CLIP - Supabase + chrome.storage fallback
// =============================================
async function saveClip(clip, sendResponse) {
  const userId = await getUserId();

  // Always save to chrome.storage.sync as backup
  chrome.storage.sync.get({ clips: [] }, async (data) => {
    data.clips.push(clip);
    chrome.storage.sync.set({ clips: data.clips });

    // If user is logged in, also save to Supabase
    if (userId) {
      try {
        await supabaseRequest('clips', {
          method: 'POST',
          headers: {
            'Prefer': 'return=minimal,resolution=ignore-duplicates'
          },
          body: JSON.stringify({
            user_id: userId,
            video_id: clip.videoId,
            title: clip.title,
            macro: clip.macro || 'Others',
            cat: clip.cat || 'Others',
            start_time: parseInt(clip.start) || 0,
            end_time: parseInt(clip.end) || 0
          })
        });
        console.log('Clip synced to Supabase');
      } catch (error) {
        // Sync errors are non-critical - clip is saved locally
        console.warn('Supabase sync failed (saved locally):', error.message);
      }
    }

    sendResponse({ success: true });
  });
}

// =============================================
// SAVE CATEGORY - Supabase sync
// =============================================
async function saveCategory(category) {
  const userId = await getUserId();
  const accessToken = await getAccessToken();

  if (userId && accessToken) {
    try {
      await supabaseRequest('categories', {
        method: 'POST',
        headers: {
          'Prefer': 'return=minimal,resolution=ignore-duplicates'
        },
        body: JSON.stringify({
          user_id: userId,
          name: category.name,
          icon: category.icon || null,
          macro: category.macro || 'Others'
        })
      });
    } catch (error) {
      // Non-critical sync error
      console.warn('Category sync failed:', error.message);
    }
  }
}

// =============================================
// SAVE MACRO - Supabase sync
// =============================================
async function saveMacro(macroName) {
  const userId = await getUserId();
  const accessToken = await getAccessToken();

  if (userId && accessToken) {
    try {
      await supabaseRequest('macro_categories', {
        method: 'POST',
        headers: {
          'Prefer': 'return=minimal,resolution=ignore-duplicates'
        },
        body: JSON.stringify({
          user_id: userId,
          name: macroName
        })
      });
    } catch (error) {
      // Non-critical sync error
      console.warn('Macro sync failed:', error.message);
    }
  }
}

// =============================================
// OPEN ARCHIVE - Extension archive (popup for login if needed)
// =============================================
async function openArchive() {
  const userId = await getUserId();

  if (userId) {
    // User is logged in - open extension archive
    chrome.tabs.create({ url: chrome.runtime.getURL("archive.html") });
  } else {
    // Not logged in - open popup page for login
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  }
}

// =============================================
// EXTERNAL MESSAGE HANDLER (from clippo.app)
// =============================================
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


// =============================================
// MESSAGE HANDLERS
// =============================================
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "saveClip") {
    saveClip(req.clip, sendResponse);

    // Also sync category and macro if new
    if (req.clip.cat) {
      saveCategory({ name: req.clip.cat, macro: req.clip.macro });
    }
    if (req.clip.macro) {
      saveMacro(req.clip.macro);
    }

    return true; // Keep channel open for async response
  }

  if (req.action === "openArchive") {
    openArchive();
    return false;
  }

  if (req.action === "setUserId") {
    setUserId(req.userId).then(() => sendResponse({ success: true }));
    return true;
  }

  if (req.action === "getUserId") {
    getUserId().then((userId) => sendResponse({ userId }));
    return true;
  }

  if (req.action === "logout") {
    // Clear all auth tokens
    chrome.storage.local.remove([
      'clippo_user_id',
      'clippo_user_email',
      'clippo_access_token',
      'clippo_refresh_token'
    ], () => {
      // Notify all YouTube tabs to reset auth state
      chrome.tabs.query({ url: "https://www.youtube.com/*" }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: "authLogout" }).catch(() => {});
        });
      });

      // Also clear session on clippo.app by opening logout endpoint
      // This will clear Supabase session on the web domain
      chrome.tabs.create({
        url: 'https://clippo.app/auth/logout/',
        active: false
      }, (tab) => {
        // Close the logout tab after a short delay
        setTimeout(() => {
          chrome.tabs.remove(tab.id).catch(() => {});
        }, 2000);
      });

      sendResponse({ success: true });
    });
    return true;
  }
});

// =============================================
// INJECT AND TOGGLE WIDGET
// =============================================
function injectAndToggle(tabId) {
  // Content script is auto-injected by manifest on YouTube watch pages
  // Just send the toggle message - no need to re-inject
  chrome.tabs.sendMessage(tabId, { action: "toggleWidget" }).catch(() => {
    // If message fails (script not loaded yet), try injecting once
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    }).then(() => {
      chrome.tabs.sendMessage(tabId, { action: "toggleWidget" });
    }).catch(() => {
      // If injection fails, open archive
      openArchive();
    });
  });
}

// =============================================
// EXTENSION ICON CLICK
// =============================================
chrome.action.onClicked.addListener(tab => {
  const url = tab.url || "";
  if (url.includes("youtube.com/watch")) {
    injectAndToggle(tab.id);
  } else {
    openArchive();
  }
});

// =============================================
// KEYBOARD SHORTCUT (Ctrl+Shift+Y)
// =============================================
chrome.commands.onCommand.addListener((command) => {
  console.log('Clippo: Command received:', command);
  if (command === "toggle-widget") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Clippo: tabs query error:', chrome.runtime.lastError);
        return;
      }
      const t = tabs[0];
      const url = t?.url || "";
      console.log('Clippo: Active tab URL:', url);
      if (url.includes("youtube.com/watch")) {
        injectAndToggle(t.id);
      } else {
        openArchive();
      }
    });
  }
});

// =============================================
// SYNC ON EXTENSION STARTUP
// =============================================
chrome.runtime.onStartup.addListener(async () => {
  const userId = await getUserId();

  if (!userId) return;

  // Sync local clips to Supabase on startup
  chrome.storage.sync.get({ clips: [], categories: [], macroCategories: [] }, async (data) => {
    // Sync clips
    for (const clip of data.clips) {
      try {
        await supabaseRequest('clips', {
          method: 'POST',
          headers: {
            'Prefer': 'resolution=ignore-duplicates'
          },
          body: JSON.stringify({
            user_id: userId,
            video_id: clip.videoId,
            title: clip.title,
            macro: clip.macro || 'Others',
            cat: clip.cat || 'Others',
            start_time: clip.start,
            end_time: clip.end
          })
        });
      } catch (error) {
        // Ignore duplicate errors
      }
    }

    // Sync categories
    for (const cat of data.categories) {
      const catObj = typeof cat === 'object' ? cat : { name: cat, macro: 'Others' };
      await saveCategory(catObj);
    }

    // Sync macros
    for (const macro of data.macroCategories) {
      await saveMacro(macro);
    }

    console.log('Startup sync complete');
  });
});
