// Archive extras: theme toggle button + user avatar (Gravatar)

// Theme toggle button (FAB)
document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('clippo_theme', next);
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ clippo_theme: next });
  }
});

// SHA-256 hash for Gravatar (new spec)
async function sha256(str) {
  const buffer = new TextEncoder().encode(str.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Populate user info in sidebar header
chrome.storage.local.get(['clippo_username', 'clippo_user_email'], async (data) => {
  const email = data.clippo_user_email || '';
  const username = data.clippo_username || email || 'Guest';
  const nameEl = document.getElementById('userName');
  const avatarEl = document.getElementById('userAvatar');
  if (nameEl) nameEl.textContent = username;

  if (avatarEl) {
    avatarEl.textContent = username.charAt(0).toUpperCase();
    if (email) {
      try {
        const hash = await sha256(email);
        const img = new Image();
        img.src = `https://www.gravatar.com/avatar/${hash}?s=72&d=404`;
        img.onload = () => {
          avatarEl.textContent = '';
          avatarEl.style.background = `url(${img.src}) center/cover`;
        };
      } catch (e) { /* keep initial fallback */ }
    }
  }
});
