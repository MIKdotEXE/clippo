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

// Change password — send reset email directly
document.getElementById('change-password-btn').addEventListener('click', async () => {
  const btn = document.getElementById('change-password-btn');

  chrome.storage.local.get(['clippo_user_email'], async (data) => {
    const email = data.clippo_user_email;
    if (!email) {
      alert('No email found. Please log in first.');
      return;
    }

    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
      const SUPABASE_URL = 'https://phnfwoqyyqnqmmteygnb.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobmZ3b3F5eXFucW1tdGV5Z25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTQwNjQsImV4cCI6MjA4MjQzMDA2NH0.j_9AV-MeZXhRdlrn-O9mMdvgvokSXexUnKIS2r9mljc';

      const redirectTo = encodeURIComponent('https://clippo.app/auth/reset/');
      const response = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${redirectTo}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) throw new Error('Failed to send');

      btn.textContent = 'Email sent!';
      setTimeout(() => {
        btn.textContent = 'Reset';
        btn.disabled = false;
      }, 3000);
    } catch (e) {
      btn.textContent = 'Failed';
      setTimeout(() => {
        btn.textContent = 'Reset';
        btn.disabled = false;
      }, 2000);
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
