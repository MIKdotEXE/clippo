// content.js — inject & toggle Clippo widget in-page, con creazione automatica di macro e categorie

// Guard against multiple injections
if (window.__clippo_loaded) {
  // Already loaded, just toggle if message listener handles it
  // This block is hit when background.js re-injects the script
} else {
  window.__clippo_loaded = true;
}

// Use var to allow re-declaration, and only initialize once
if (typeof widget === 'undefined') {
  var widget = null;
  var isVisible = false;
  var pendingToggle = false;
  var isLoggedIn = false;
  var currentVideo = null;
}

// Clippo Brand Colors - Red & White theme
if (typeof COLORS === 'undefined') {
  var COLORS = {
    brandPrimary: "#ed1c24",
    brandDark: "#c41920",
    brandLight: "#ff3b42",
    bgWhite: "#ffffff",
    bgLight: "#fafafa",
    borderLight: "rgba(237, 28, 36, 0.15)",
    borderMedium: "rgba(237, 28, 36, 0.3)",
    textPrimary: "#1a1a1a",
    textSecondary: "#4a4a4a",
    textMuted: "#7a7a7a",
    textOnBrand: "#ffffff",
    accentDanger: "#ed1c24"
  };
}

// Ascolta i messaggi dal background
// Only add listener once
if (!window.__clippo_listener_added) {
  window.__clippo_listener_added = true;
  chrome.runtime.onMessage.addListener((msg) => {
    try {
      if (msg.action === "toggleWidget") {
        if (!widget) {
          pendingToggle = true;
          initWidget();
        } else {
          toggleWidget();
        }
      }

      if (msg.action === "authLogout") {
        // User logged out - reset widget state
        isLoggedIn = false;
        if (widget) {
          // Rebuild widget to show login form
          widget.remove();
          widget = null;
          if (currentVideo) {
            createWidget(currentVideo);
          }
        }
      }
    } catch (e) {
      // Extension context may be invalidated after reload
      console.warn('Clippo: message handling error', e);
    }
  });
}

// Settings (defaults)
if (typeof clippoSettings === 'undefined') {
  var clippoSettings = {
    showOverlay: true,
    autoPause: false,
    showControls: true
  };
}

// Listen for settings changes in real-time
if (!window.__clippo_settings_listener) {
  window.__clippo_settings_listener = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.clippo_show_overlay !== undefined) {
      clippoSettings.showOverlay = changes.clippo_show_overlay.newValue;
      const btn = document.getElementById("clippo-overlay-btn");
      if (btn) btn.style.display = clippoSettings.showOverlay ? "flex" : "none";
    }
    if (changes.clippo_autopause !== undefined) {
      clippoSettings.autoPause = changes.clippo_autopause.newValue;
    }
    if (changes.clippo_show_controls !== undefined) {
      clippoSettings.showControls = changes.clippo_show_controls.newValue;
      const ctrl = document.getElementById("vm-video-controls");
      if (ctrl) ctrl.style.display = clippoSettings.showControls ? "" : "none";
    }
  });
}

// Load settings then init
if (!window.__clippo_init_started) {
  window.__clippo_init_started = true;
  try {
    chrome.storage.local.get(['clippo_show_overlay', 'clippo_autopause', 'clippo_show_controls'], (data) => {
      if (chrome.runtime.lastError) { initWidget(); return; }
      if (data.clippo_show_overlay !== undefined) clippoSettings.showOverlay = data.clippo_show_overlay;
      if (data.clippo_autopause !== undefined) clippoSettings.autoPause = data.clippo_autopause;
      if (data.clippo_show_controls !== undefined) clippoSettings.showControls = data.clippo_show_controls;
      initWidget();
    });
  } catch (e) {
    initWidget();
  }
}

function initWidget() {
  const video = document.querySelector("video");
  if (video) {
    createWidget(video);
    if (pendingToggle) {
      toggleWidget();
      pendingToggle = false;
    }
  } else {
    setTimeout(initWidget, 500);
  }
}

function toggleWidget() {
  isVisible = !isVisible;
  widget.style.display = isVisible ? "block" : "none";
  if (isVisible) {
    widget.style.animation = "vmSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards";
  }
}

async function checkAuth() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: "getUserId" }, (response) => {
        if (chrome.runtime.lastError) {
          // Extension context invalidated
          isLoggedIn = false;
          resolve(false);
          return;
        }
        isLoggedIn = !!(response && response.userId);
        resolve(isLoggedIn);
      });
    } catch (e) {
      // Extension context invalidated
      isLoggedIn = false;
      resolve(false);
    }
  });
}

function createWidget(video) {
  currentVideo = video;

  // Import fonts + CSS
  if (!document.getElementById("vm-style")) {
    const style = document.createElement("style");
    style.id = "vm-style";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Zain:wght@400;700;800;900&display=swap');

      @keyframes vmSlideIn {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      @keyframes vmPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(237, 28, 36, 0.4); }
        50% { box-shadow: 0 0 0 8px rgba(237, 28, 36, 0); }
      }

      #clippo-overlay-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: rgba(237, 28, 36, 0.7);
        border: none;
        cursor: pointer;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.5;
        transition: opacity 0.2s ease, transform 0.2s ease;
        padding: 0;
      }

      #clippo-overlay-btn:hover {
        opacity: 1;
        transform: scale(1.1);
      }

      #clippo-overlay-btn img {
        width: 22px;
        height: 22px;
        pointer-events: none;
      }

      .vm-video-controls {
        display: flex;
        gap: 6px;
        margin: 4px 0 8px;
      }

      .vm-video-controls button {
        flex: 1;
        padding: 6px 4px;
        background: ${COLORS.bgLight};
        border: 1px solid ${COLORS.borderLight};
        border-radius: 6px;
        color: ${COLORS.textSecondary};
        font-family: 'Zain', sans-serif !important;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
      }

      .vm-video-controls button:hover {
        background: ${COLORS.brandPrimary};
        border-color: ${COLORS.brandPrimary};
        color: ${COLORS.textOnBrand};
      }

      #clippo-widget, #clippo-widget * {
        font-family: 'Zain', sans-serif !important;
        box-sizing: border-box;
      }

      #clippo-widget {
        background: ${COLORS.bgWhite};
        border: 2px solid ${COLORS.borderMedium};
        padding: 16px;
        border-radius: 14px;
        box-shadow: 0 8px 32px rgba(237, 28, 36, 0.15);
        color: ${COLORS.textPrimary};
      }

      #clippo-widget .vm-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid ${COLORS.borderLight};
      }

      #clippo-widget .vm-logo-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      #clippo-widget .vm-logo-img {
        width: 24px;
        height: 24px;
        border-radius: 4px;
      }

      #clippo-widget .vm-logo {
        font-family: 'Zain', sans-serif !important;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: ${COLORS.brandDark};
      }

      #clippo-widget .vm-close-btn {
        width: 24px;
        height: 24px;
        padding: 0;
        background: transparent;
        border: 1px solid ${COLORS.borderLight};
        border-radius: 6px;
        color: ${COLORS.textMuted};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      #clippo-widget .vm-close-btn:hover {
        background: ${COLORS.accentDanger};
        border-color: ${COLORS.accentDanger};
        color: white;
      }

      #clippo-widget .vm-label {
        font-family: 'Zain', sans-serif !important;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: ${COLORS.textMuted};
        margin: 12px 0 5px;
        display: block;
      }

      #clippo-widget input[type="text"] {
        display: block;
        width: 100%;
        padding: 10px 12px;
        background: ${COLORS.bgLight};
        border: 1px solid ${COLORS.borderLight};
        border-radius: 8px;
        font-size: 13px;
        color: ${COLORS.textPrimary};
        transition: all 0.2s ease;
      }

      #clippo-widget input[type="text"]:focus {
        outline: none;
        border-color: ${COLORS.brandPrimary};
        box-shadow: 0 0 0 3px rgba(237, 28, 36, 0.12);
      }

      #clippo-widget input[type="text"]::placeholder {
        color: ${COLORS.textMuted};
      }

      #clippo-widget .vm-time-row {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 8px;
        align-items: end;
        margin: 12px 0;
      }

      #clippo-widget .vm-time-group {
        display: flex;
        flex-direction: column;
      }

      #clippo-widget .vm-time-group input {
        text-align: center;
        font-family: 'Zain', sans-serif !important;
        font-size: 14px;
        font-weight: 700;
        color: ${COLORS.brandPrimary};
        padding: 8px;
      }

      #clippo-widget .vm-time-separator {
        font-family: 'Zain', sans-serif !important;
        font-size: 16px;
        font-weight: 700;
        color: ${COLORS.textMuted};
        padding-bottom: 10px;
      }

      #clippo-widget .vm-set-btn {
        width: 100%;
        padding: 6px 8px;
        margin-bottom: 6px;
        background: ${COLORS.bgLight};
        border: 1px solid ${COLORS.borderLight};
        border-radius: 6px;
        color: ${COLORS.textSecondary};
        font-family: 'Zain', sans-serif !important;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      #clippo-widget .vm-set-btn:hover {
        background: ${COLORS.brandPrimary};
        border-color: ${COLORS.brandPrimary};
        color: ${COLORS.textOnBrand};
      }

      #clippo-widget .vm-duration {
        text-align: center;
        font-family: 'Zain', sans-serif !important;
        font-size: 11px;
        font-weight: 700;
        color: ${COLORS.textMuted};
        margin: -4px 0 8px;
        min-height: 16px;
      }

      #clippo-widget .vm-duration.has-value {
        color: ${COLORS.brandPrimary};
      }

      #clippo-widget .vm-actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid ${COLORS.borderLight};
      }

      #clippo-widget .vm-btn-primary {
        flex: 2;
        padding: 11px 14px;
        background: linear-gradient(135deg, ${COLORS.brandPrimary}, ${COLORS.brandDark});
        border: none;
        border-radius: 8px;
        color: ${COLORS.textOnBrand};
        font-family: 'Zain', sans-serif !important;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      #clippo-widget .vm-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 15px rgba(237, 28, 36, 0.3);
      }

      #clippo-widget .vm-btn-secondary {
        flex: 1;
        padding: 11px 10px;
        background: ${COLORS.bgWhite};
        border: 1px solid ${COLORS.borderMedium};
        border-radius: 8px;
        color: ${COLORS.brandPrimary};
        font-family: 'Zain', sans-serif !important;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.3px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      #clippo-widget .vm-btn-secondary:hover {
        background: ${COLORS.brandPrimary};
        border-color: ${COLORS.brandPrimary};
        color: ${COLORS.textOnBrand};
      }

      #clippo-widget .vm-recording {
        animation: vmPulse 2s infinite;
      }

      /* Auth Form Styles */
      #clippo-widget .vm-auth-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 14px;
      }

      #clippo-widget .vm-auth-tab {
        flex: 1;
        padding: 8px;
        border: 1px solid ${COLORS.borderMedium};
        background: ${COLORS.bgWhite};
        border-radius: 6px;
        font-family: 'Zain', sans-serif !important;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: ${COLORS.textSecondary};
        cursor: pointer;
        transition: all 0.2s ease;
      }

      #clippo-widget .vm-auth-tab:hover {
        border-color: ${COLORS.brandPrimary};
        color: ${COLORS.brandPrimary};
      }

      #clippo-widget .vm-auth-tab.active {
        background: linear-gradient(135deg, ${COLORS.brandPrimary}, ${COLORS.brandDark});
        border-color: ${COLORS.brandPrimary};
        color: ${COLORS.textOnBrand};
      }

      #clippo-widget .vm-auth-message {
        padding: 8px;
        border-radius: 6px;
        font-size: 11px;
        margin-top: 10px;
        display: none;
      }

      #clippo-widget .vm-auth-message.error {
        display: block;
        background: rgba(231, 76, 60, 0.1);
        border: 1px solid rgba(231, 76, 60, 0.3);
        color: ${COLORS.accentDanger};
      }

      #clippo-widget .vm-auth-message.success {
        display: block;
        background: rgba(39, 174, 96, 0.1);
        border: 1px solid rgba(39, 174, 96, 0.3);
        color: #27ae60;
      }

      #clippo-widget .vm-auth-form {
        display: none;
      }

      #clippo-widget .vm-auth-form.active {
        display: block;
      }

      #clippo-widget .vm-auth-welcome {
        text-align: center;
        padding: 10px 0;
        color: ${COLORS.textSecondary};
        font-size: 12px;
        line-height: 1.5;
      }
    `;
    document.head.appendChild(style);
  }

  // Build widget (hidden)
  widget = document.createElement("div");
  widget.id = "clippo-widget";
  widget.style.cssText = `
    position: fixed;
    top: 80px;
    right: 16px;
    width: 260px;
    z-index: 999999;
    display: none;
  `;

  // Check auth status and render appropriate UI
  checkAuth().then((loggedIn) => {
    if (loggedIn) {
      renderClipForm();
    } else {
      renderAuthForm();
    }
  });

  document.body.appendChild(widget);

  // Add overlay button on YouTube video player
  if (clippoSettings.showOverlay && !document.getElementById("clippo-overlay-btn")) {
    const addOverlayBtn = () => {
      const playerContainer = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
      if (!playerContainer) {
        setTimeout(addOverlayBtn, 500);
        return;
      }
      // Ensure container is positioned for absolute children
      if (getComputedStyle(playerContainer).position === "static") {
        playerContainer.style.position = "relative";
      }
      const btn = document.createElement("button");
      btn.id = "clippo-overlay-btn";
      btn.title = "Open Clippo";
      btn.innerHTML = `<img src="https://phnfwoqyyqnqmmteygnb.supabase.co/storage/v1/object/public/assets/icon_48_n.png" alt="Clippo"/>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleWidget();
      });
      playerContainer.appendChild(btn);
    };
    addOverlayBtn();
  }
}

function setupLogoFallback() {
  const logoImg = widget.querySelector(".vm-logo-img");
  if (logoImg) {
    logoImg.onerror = () => {
      const svgFallback = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgFallback.setAttribute("width", "24");
      svgFallback.setAttribute("height", "24");
      svgFallback.setAttribute("viewBox", "0 0 24 24");
      svgFallback.setAttribute("class", "vm-logo-img");
      svgFallback.innerHTML = `
        <rect width="24" height="24" rx="4" fill="${COLORS.brandPrimary}"/>
        <path d="M8 6v12l10-6z" fill="white"/>
      `;
      logoImg.replaceWith(svgFallback);
    };
  }
}

function renderAuthForm() {
  widget.innerHTML = `
    <div class="vm-header">
      <div class="vm-logo-container">
        <img class="vm-logo-img" src="https://phnfwoqyyqnqmmteygnb.supabase.co/storage/v1/object/public/assets/icon_48.png" alt="Clippo"/>
        <span class="vm-logo">Clippo</span>
      </div>
      <button class="vm-close-btn" id="vm-close" title="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div class="vm-auth-welcome">
      Sign in to save clips and sync across devices
    </div>

    <div class="vm-auth-tabs">
      <button class="vm-auth-tab active" id="vm-login-tab">Login</button>
      <button class="vm-auth-tab" id="vm-signup-tab">Sign Up</button>
    </div>

    <!-- Login Form -->
    <div class="vm-auth-form active" id="vm-login-form">
      <label class="vm-label">Email</label>
      <input type="email" id="vm-login-email" placeholder="you@example.com"/>

      <label class="vm-label">Password</label>
      <input type="password" id="vm-login-password" placeholder="Your password"/>

      <div class="vm-actions">
        <button class="vm-btn-primary" id="vm-login-btn">Login</button>
      </div>
      <div class="vm-auth-message" id="vm-login-message"></div>
    </div>

    <!-- Signup Form -->
    <div class="vm-auth-form" id="vm-signup-form">
      <label class="vm-label">Email</label>
      <input type="email" id="vm-signup-email" placeholder="you@example.com"/>

      <label class="vm-label">Password</label>
      <input type="password" id="vm-signup-password" placeholder="Min 6 characters"/>

      <label class="vm-label">Confirm Password</label>
      <input type="password" id="vm-signup-confirm" placeholder="Confirm password"/>

      <div class="vm-actions">
        <button class="vm-btn-primary" id="vm-signup-btn">Create Account</button>
      </div>
      <div class="vm-auth-message" id="vm-signup-message"></div>
    </div>
  `;

  setupLogoFallback();
  bindAuthForm();
}

function renderClipForm() {
  widget.innerHTML = `
    <div class="vm-header">
      <div class="vm-logo-container">
        <img class="vm-logo-img" src="https://phnfwoqyyqnqmmteygnb.supabase.co/storage/v1/object/public/assets/icon_48.png" alt="Clippo"/>
        <span class="vm-logo">Clippo</span>
      </div>
      <button class="vm-close-btn" id="vm-close" title="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <label class="vm-label">Clip Title</label>
    <input type="text" id="vm-title" placeholder="Enter a title for this clip"/>

    <label class="vm-label">Macro Category</label>
    <input type="text" id="vm-macro" placeholder="e.g. Gaming" list="vm-macro-list"/>
    <datalist id="vm-macro-list"></datalist>

    <label class="vm-label">Category</label>
    <input type="text" id="vm-cat" placeholder="e.g. Walkthrough" list="vm-cat-list"/>
    <datalist id="vm-cat-list"></datalist>

    <div class="vm-time-row">
      <div class="vm-time-group">
        <button class="vm-set-btn" id="vm-set-start">Set Start</button>
        <input type="text" id="vm-start" placeholder="0:00"/>
      </div>
      <span class="vm-time-separator">→</span>
      <div class="vm-time-group">
        <button class="vm-set-btn" id="vm-set-end">Set End</button>
        <input type="text" id="vm-end" placeholder="0:00"/>
      </div>
    </div>
    <div id="vm-duration" class="vm-duration"></div>

    <div class="vm-video-controls" id="vm-video-controls" style="${clippoSettings.showControls ? '' : 'display:none'}">
      <button id="vm-back5" title="Back 5 seconds">◀ 5s</button>
      <button id="vm-playpause" title="Play/Pause">⏯ Play</button>
      <button id="vm-fwd5" title="Forward 5 seconds">5s ▶</button>
    </div>

    <div class="vm-actions">
      <button class="vm-btn-primary" id="vm-save">Save Clip</button>
      <button class="vm-btn-secondary" id="vm-open-archive">Archive</button>
    </div>
  `;

  setupLogoFallback();
  bindWidget(currentVideo);
  loadLists();

  setTimeout(() => {
    const macroInput = document.getElementById("vm-macro");
    if (macroInput) {
      macroInput.addEventListener("input", filterCategoriesByMacro);
      filterCategoriesByMacro();
    }
  }, 0);
}

if (typeof SUPABASE_URL === 'undefined') {
  var SUPABASE_URL = 'https://phnfwoqyyqnqmmteygnb.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobmZ3b3F5eXFucW1tdGV5Z25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTQwNjQsImV4cCI6MjA4MjQzMDA2NH0.j_9AV-MeZXhRdlrn-O9mMdvgvokSXexUnKIS2r9mljc';
}

async function supabaseAuth(endpoint, body) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.message || 'Authentication failed');
  }

  return data;
}

function bindAuthForm() {
  const $ = id => document.getElementById(id);

  // Close button
  $("vm-close").onclick = () => toggleWidget();

  // Tab switching
  $("vm-login-tab").onclick = () => {
    $("vm-login-tab").classList.add("active");
    $("vm-signup-tab").classList.remove("active");
    $("vm-login-form").classList.add("active");
    $("vm-signup-form").classList.remove("active");
    clearAuthMessages();
  };

  $("vm-signup-tab").onclick = () => {
    $("vm-signup-tab").classList.add("active");
    $("vm-login-tab").classList.remove("active");
    $("vm-signup-form").classList.add("active");
    $("vm-login-form").classList.remove("active");
    clearAuthMessages();
  };

  // Login
  $("vm-login-btn").onclick = async () => {
    clearAuthMessages();
    const email = $("vm-login-email").value.trim();
    const password = $("vm-login-password").value;

    if (!email || !password) {
      showAuthMessage("vm-login-message", "Please fill in all fields", "error");
      return;
    }

    $("vm-login-btn").textContent = "...";
    $("vm-login-btn").disabled = true;

    try {
      const data = await supabaseAuth('token?grant_type=password', { email, password });

      // Save auth data
      await chrome.storage.local.set({
        clippo_user_id: data.user.id,
        clippo_user_email: data.user.email,
        clippo_access_token: data.access_token,
        clippo_refresh_token: data.refresh_token
      });

      isLoggedIn = true;
      showAuthMessage("vm-login-message", "Success! Loading...", "success");

      setTimeout(() => renderClipForm(), 500);

    } catch (error) {
      showAuthMessage("vm-login-message", error.message, "error");
      $("vm-login-btn").textContent = "Login";
      $("vm-login-btn").disabled = false;
    }
  };

  // Signup
  $("vm-signup-btn").onclick = async () => {
    clearAuthMessages();
    const email = $("vm-signup-email").value.trim();
    const password = $("vm-signup-password").value;
    const confirm = $("vm-signup-confirm").value;

    if (!email || !password || !confirm) {
      showAuthMessage("vm-signup-message", "Please fill in all fields", "error");
      return;
    }

    if (password !== confirm) {
      showAuthMessage("vm-signup-message", "Passwords do not match", "error");
      return;
    }

    if (password.length < 6) {
      showAuthMessage("vm-signup-message", "Password must be at least 6 characters", "error");
      return;
    }

    $("vm-signup-btn").textContent = "...";
    $("vm-signup-btn").disabled = true;

    try {
      const data = await supabaseAuth('signup', { email, password });

      if (data.user && !data.session) {
        showAuthMessage("vm-signup-message", "Check your email to confirm!", "success");
      } else if (data.access_token) {
        await chrome.storage.local.set({
          clippo_user_id: data.user.id,
          clippo_user_email: data.user.email,
          clippo_access_token: data.access_token,
          clippo_refresh_token: data.refresh_token
        });

        isLoggedIn = true;
        showAuthMessage("vm-signup-message", "Account created!", "success");

        setTimeout(() => renderClipForm(), 500);
      }

    } catch (error) {
      showAuthMessage("vm-signup-message", error.message, "error");
    } finally {
      $("vm-signup-btn").textContent = "Create Account";
      $("vm-signup-btn").disabled = false;
    }
  };
}

function clearAuthMessages() {
  const loginMsg = document.getElementById("vm-login-message");
  const signupMsg = document.getElementById("vm-signup-message");
  if (loginMsg) loginMsg.className = "vm-auth-message";
  if (signupMsg) signupMsg.className = "vm-auth-message";
}

function showAuthMessage(id, text, type) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
    el.className = `vm-auth-message ${type}`;
  }
}

function loadLists() {
  try {
    chrome.storage.sync.get({
      categories: [],
      macroCategories: ["Others","Gaming","Tutorials","Entertainment"]
    }, data => {
      if (chrome.runtime.lastError) return;
      const dlM = document.getElementById("vm-macro-list");
      const dlC = document.getElementById("vm-cat-list");
      if (!dlM || !dlC) return;
      dlM.innerHTML = "";
      dlC.innerHTML = "";

      const macros = data.macroCategories.includes("Others")
        ? data.macroCategories
        : ["Others", ...data.macroCategories];
      const cats = data.categories.map(c =>
        (typeof c === "object" && c.name) ? c.name : c
      );
      if (!cats.includes("Others")) cats.unshift("Others");

      macros.forEach(m => {
        const o = document.createElement("option");
        o.value = m;
        dlM.appendChild(o);
      });
      cats.forEach(c => {
        const o = document.createElement("option");
        o.value = c;
        dlC.appendChild(o);
      });
    });
  } catch (e) {
    // Extension context invalidated
  }
}

// Helper: format seconds as mm:ss
function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper: parse mm:ss to seconds
function parseTime(timeStr) {
  if (!timeStr) return NaN;
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  // Fallback: try parsing as plain seconds
  return parseInt(timeStr, 10);
}

function bindWidget(video) {
  const $ = id => document.getElementById(id);
  const getTime = () => formatTime(Math.floor(video.currentTime));

  function updateDuration() {
    const dur = $("vm-duration");
    const s = parseTime($("vm-start").value);
    const e = parseTime($("vm-end").value);
    if (!isNaN(s) && !isNaN(e) && e > s) {
      dur.textContent = `Duration: ${formatTime(e - s)}`;
      dur.classList.add("has-value");
    } else {
      dur.textContent = "";
      dur.classList.remove("has-value");
    }
  }

  $("vm-set-start").addEventListener("click", () => {
    $("vm-start").value = getTime();
    if (clippoSettings.autoPause && !video.paused) video.pause();
    updateDuration();
  });
  $("vm-set-end").addEventListener("click", () => {
    $("vm-end").value = getTime();
    if (clippoSettings.autoPause && !video.paused) video.pause();
    updateDuration();
  });
  $("vm-start").addEventListener("input", updateDuration);
  $("vm-end").addEventListener("input", updateDuration);

  // Video playback controls
  const ppBtn = $("vm-playpause");
  $("vm-back5").addEventListener("click", () => {
    video.currentTime = Math.max(0, video.currentTime - 5);
  });
  $("vm-fwd5").addEventListener("click", () => {
    video.currentTime = Math.min(video.duration, video.currentTime + 5);
  });
  ppBtn.addEventListener("click", () => {
    if (video.paused) {
      video.play();
      ppBtn.textContent = "⏸ Pause";
    } else {
      video.pause();
      ppBtn.textContent = "▶ Play";
    }
  });
  // Sync button text with video state
  video.addEventListener("play", () => { ppBtn.textContent = "⏸ Pause"; });
  video.addEventListener("pause", () => { ppBtn.textContent = "▶ Play"; });

  $("vm-save").addEventListener("click", () => {
    const title = $("vm-title").value.trim();
    const macro = $("vm-macro").value.trim() || "Others";
    const cat   = $("vm-cat").value.trim()   || "Others";
    const start = parseTime($("vm-start").value);
    const end   = parseTime($("vm-end").value);

    // Validazione
    if (!title)                   return alert("Please enter a title");
    if (isNaN(start) || isNaN(end)) return alert("Invalid start/end");
    if (start >= end)             return alert("Start must be < End");

    const videoId = new URL(location.href).searchParams.get("v");
    if (!videoId) return alert("Video ID not found");

    // Prima: aggiorna macroCategories e categories
    try {
      chrome.storage.sync.get({
        categories: [],
        macroCategories: ["Others","Gaming","Tutorials","Entertainment"]
      }, data => {
        if (chrome.runtime.lastError) {
          alert("Extension error. Please refresh the page.");
          return;
        }
        const newMacros = Array.from(new Set([...(data.macroCategories || []), macro]));
        // categories come oggetti {name, icon, macro}
        const existingCats = data.categories.map(c =>
          (typeof c === "object" && c.name) ? c.name : c
        );
        let newCats = data.categories.map(c =>
          (typeof c === "object" && c.name) ? c : { name: c, icon: null, macro: "Others" }
        );
        if (!existingCats.includes(cat)) {
          newCats.push({ name: cat, icon: null, macro });
        }
        // Salva macroCategories e categories
        chrome.storage.sync.set({
          macroCategories: newMacros,
          categories: newCats
        }, () => {
          if (chrome.runtime.lastError) {
            alert("Extension error. Please refresh the page.");
            return;
          }
          // Dopo aver aggiornato le liste, salva il clip
          const clip = { videoId, title, macro, cat, start, end };
          try {
            chrome.runtime.sendMessage({ action: "saveClip", clip }, resp => {
              if (chrome.runtime.lastError) {
                alert("Extension error. Please refresh the page.");
                return;
              }
              if (resp?.success) {
                // Show success feedback (widget stays open)
                const saveBtn = $("vm-save");
                const origText = saveBtn.textContent;
                saveBtn.textContent = "✓ Saved!";
                saveBtn.style.background = "#27ae60";
                ["vm-title","vm-macro","vm-cat","vm-start","vm-end"]
                  .forEach(id => $(id).value = "");
                loadLists();
                filterCategoriesByMacro();
                setTimeout(() => {
                  saveBtn.textContent = origText;
                  saveBtn.style.background = "";
                }, 1200);
              } else {
                alert("Error saving clip");
              }
            });
          } catch (e) {
            alert("Extension error. Please refresh the page.");
          }
        });
      });
    } catch (e) {
      alert("Extension error. Please refresh the page.");
    }
  });

  $("vm-open-archive").addEventListener("click", () => {
    try {
      if (video && !video.paused) video.pause();
      chrome.runtime.sendMessage({ action: "openArchive" });
    } catch (e) {
      // Extension context invalidated
    }
  });
  $("vm-close").addEventListener("click", () => {
    isVisible = false;
    widget.style.display = "none";
  });
}

// --- NUOVA FUNZIONE ---
// Filtra la datalist delle categorie in base alla macro selezionata
function filterCategoriesByMacro() {
  try {
    chrome.storage.sync.get({
      categories: [],
      macroCategories: ["Others","Gaming","Tutorials","Entertainment"]
    }, data => {
      if (chrome.runtime.lastError) return;
      const macroEl = document.getElementById("vm-macro");
      const dlC = document.getElementById("vm-cat-list");
      if (!macroEl || !dlC) return;
      const macro = macroEl.value.trim();
      dlC.innerHTML = "";
      // Mostra solo le categorie collegate alla macro selezionata
      let cats = data.categories.filter(c =>
        (typeof c === "object" && c.name && c.macro === macro)
      );
      // Fallback: se non c'è macro scritta o nessuna categoria collegata, mostra solo "Others"
      if (!macro || !cats.length) {
        cats = data.categories.filter(c =>
          (typeof c === "object" && c.name && c.macro === "Others")
        );
      }
      // Rimuovi duplicati
      const catNames = [...new Set(cats.map(c => c.name))];
      catNames.forEach(c => {
        const o = document.createElement("option");
        o.value = c;
        dlC.appendChild(o);
      });
    });
  } catch (e) {
    // Extension context invalidated
  }
}
