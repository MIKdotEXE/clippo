// Theme loader — runs before render to prevent FOUC
// Uses localStorage as sync cache, syncs with chrome.storage async
(function() {
  const cached = localStorage.getItem('clippo_theme');
  const defaultTheme = document.documentElement.dataset.defaultTheme || 'light';
  const initial = cached || defaultTheme;
  document.documentElement.setAttribute('data-theme', initial);
  console.log('[Clippo theme] initial:', initial, 'cached:', cached);

  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['clippo_theme'], (data) => {
      console.log('[Clippo theme] chrome.storage value:', data.clippo_theme);
      if (data.clippo_theme) {
        if (data.clippo_theme !== initial) {
          document.documentElement.setAttribute('data-theme', data.clippo_theme);
          localStorage.setItem('clippo_theme', data.clippo_theme);
          console.log('[Clippo theme] updated to', data.clippo_theme);
        }
      } else if (cached) {
        chrome.storage.local.set({ clippo_theme: cached });
      }
    });

    // Listen for theme changes from other pages
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.clippo_theme) {
        const newTheme = changes.clippo_theme.newValue;
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('clippo_theme', newTheme);
        console.log('[Clippo theme] changed via storage to', newTheme);
      }
    });
  }
})();
