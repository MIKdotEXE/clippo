// Clippo Settings

const DEFAULTS = {
  clippo_show_overlay: true,
  clippo_autopause: false,
  clippo_show_controls: true
};

const settingMap = {
  'setting-overlay': 'clippo_show_overlay',
  'setting-autopause': 'clippo_autopause',
  'setting-controls': 'clippo_show_controls'
};

// Load settings
chrome.storage.local.get([...Object.values(settingMap), 'clippo_user_email'], (data) => {
  for (const [elId, key] of Object.entries(settingMap)) {
    const el = document.getElementById(elId);
    if (el) {
      el.checked = data[key] !== undefined ? data[key] : DEFAULTS[key];
    }
  }

  const emailEl = document.getElementById('user-email');
  if (data.clippo_user_email) {
    emailEl.textContent = data.clippo_user_email;
  }
});

// Save on toggle change
for (const [elId, key] of Object.entries(settingMap)) {
  document.getElementById(elId).addEventListener('change', (e) => {
    chrome.storage.local.set({ [key]: e.target.checked }, () => {
      const msg = document.getElementById('save-msg');
      msg.classList.add('show');
      setTimeout(() => msg.classList.remove('show'), 1500);
    });
  });
}

// Close settings
document.getElementById('close-settings').addEventListener('click', () => {
  window.close();
});
