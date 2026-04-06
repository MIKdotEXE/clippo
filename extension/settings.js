// Clippo Settings

const DEFAULTS = {
  clippo_show_overlay: true,
  clippo_autopause: false,
  clippo_show_controls: true,
  clippo_theme: 'light',
  clippo_username: ''
};

const toggleMap = {
  'setting-overlay': 'clippo_show_overlay',
  'setting-autopause': 'clippo_autopause',
  'setting-controls': 'clippo_show_controls'
};

// Load all settings
chrome.storage.local.get(
  [...Object.values(toggleMap), 'clippo_theme', 'clippo_username', 'clippo_user_email'],
  (data) => {
    // Toggles
    for (const [elId, key] of Object.entries(toggleMap)) {
      const el = document.getElementById(elId);
      if (el) el.checked = data[key] !== undefined ? data[key] : DEFAULTS[key];
    }

    // Theme
    const isDark = data.clippo_theme === 'dark';
    document.getElementById('setting-theme').checked = isDark;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Username
    const usernameEl = document.getElementById('setting-username');
    if (data.clippo_username) usernameEl.value = data.clippo_username;

    // Email
    const emailEl = document.getElementById('user-email');
    if (data.clippo_user_email) emailEl.textContent = data.clippo_user_email;
  }
);

function showSaved() {
  const msg = document.getElementById('save-msg');
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 1500);
}

// Toggle settings
for (const [elId, key] of Object.entries(toggleMap)) {
  document.getElementById(elId).addEventListener('change', (e) => {
    chrome.storage.local.set({ [key]: e.target.checked }, showSaved);
  });
}

// Theme toggle
document.getElementById('setting-theme').addEventListener('change', (e) => {
  const theme = e.target.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('clippo_theme', theme);
  chrome.storage.local.set({ clippo_theme: theme }, showSaved);
});

// Username (save on blur)
let usernameTimer;
document.getElementById('setting-username').addEventListener('input', (e) => {
  clearTimeout(usernameTimer);
  usernameTimer = setTimeout(() => {
    chrome.storage.local.set({ clippo_username: e.target.value.trim() }, showSaved);
  }, 500);
});

// Change password — inline, no logout needed
document.getElementById('change-password-btn').addEventListener('click', () => {
  const btn = document.getElementById('change-password-btn');
  const row = btn.closest('.setting-row');

  // Check if form is already open
  if (row.querySelector('.pw-form')) {
    row.querySelector('.pw-form').remove();
    btn.textContent = 'Change';
    return;
  }

  const form = document.createElement('div');
  form.className = 'pw-form';
  form.style.cssText = 'margin-top:12px;display:flex;flex-direction:column;gap:8px;width:100%;';
  form.innerHTML = `
    <input type="password" id="pw-new" placeholder="New password (min 8 chars)" style="padding:10px 12px;background:var(--bg-light);border:1px solid var(--border-light);border-radius:6px;font-family:inherit;font-size:13px;color:var(--text-primary);">
    <input type="password" id="pw-confirm" placeholder="Confirm new password" style="padding:10px 12px;background:var(--bg-light);border:1px solid var(--border-light);border-radius:6px;font-family:inherit;font-size:13px;color:var(--text-primary);">
    <button id="pw-save" style="padding:10px;background:var(--brand-primary);color:#fff;border:none;border-radius:6px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">Update Password</button>
    <div id="pw-msg" style="font-size:12px;display:none;"></div>
  `;
  row.appendChild(form);
  btn.textContent = 'Cancel';

  document.getElementById('pw-save').addEventListener('click', async () => {
    const newPw = document.getElementById('pw-new').value;
    const confirmPw = document.getElementById('pw-confirm').value;
    const msg = document.getElementById('pw-msg');

    if (newPw.length < 8) {
      msg.style.display = 'block';
      msg.style.color = '#ef4444';
      msg.textContent = 'Password must be at least 8 characters';
      return;
    }
    if (newPw !== confirmPw) {
      msg.style.display = 'block';
      msg.style.color = '#ef4444';
      msg.textContent = 'Passwords do not match';
      return;
    }

    const saveBtn = document.getElementById('pw-save');
    saveBtn.textContent = 'Updating...';
    saveBtn.disabled = true;

    try {
      const SUPABASE_URL = 'https://phnfwoqyyqnqmmteygnb.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobmZ3b3F5eXFucW1tdGV5Z25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTQwNjQsImV4cCI6MjA4MjQzMDA2NH0.j_9AV-MeZXhRdlrn-O9mMdvgvokSXexUnKIS2r9mljc';

      const token = await new Promise(r => chrome.storage.local.get(['clippo_access_token'], d => r(d.clippo_access_token)));

      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: newPw })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update password');
      }

      msg.style.display = 'block';
      msg.style.color = '#22c55e';
      msg.textContent = 'Password updated!';
      setTimeout(() => {
        form.remove();
        btn.textContent = 'Change';
      }, 2000);
    } catch (e) {
      msg.style.display = 'block';
      msg.style.color = '#ef4444';
      msg.textContent = e.message;
      saveBtn.textContent = 'Update Password';
      saveBtn.disabled = false;
    }
  });
});

// Delete account
document.getElementById('delete-account-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to request account deletion? This will open an email to the Clippo team.')) {
    chrome.storage.local.get('clippo_user_email', (data) => {
      const email = data.clippo_user_email || '';
      const subject = encodeURIComponent('Clippo - Account Deletion Request');
      const body = encodeURIComponent(
        `Hi,\n\nI would like to request the deletion of my Clippo account.\n\nEmail: ${email}\n\nThank you.`
      );
      chrome.tabs.create({ url: `mailto:amendola.mic@gmail.com?subject=${subject}&body=${body}` });
    });
  }
});

// Close settings
document.getElementById('close-settings').addEventListener('click', () => {
  window.close();
});
