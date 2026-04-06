// popup.js - Extension Popup with Supabase Auth

const SUPABASE_URL = 'https://phnfwoqyyqnqmmteygnb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobmZ3b3F5eXFucW1tdGV5Z25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTQwNjQsImV4cCI6MjA4MjQzMDA2NH0.j_9AV-MeZXhRdlrn-O9mMdvgvokSXexUnKIS2r9mljc';

// DOM Elements
const loggedOutEl = document.getElementById('logged-out');
const loggedInEl = document.getElementById('logged-in');
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const loginMessage = document.getElementById('login-message');
const signupMessage = document.getElementById('signup-message');
const userEmailEl = document.getElementById('user-email');
const openArchiveBtn = document.getElementById('open-archive-btn');
const logoutBtn = document.getElementById('logout-btn');

// Supabase Auth API
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

// Tab switching
loginTab.addEventListener('click', () => {
  loginTab.classList.add('active');
  signupTab.classList.remove('active');
  loginForm.style.display = 'block';
  signupForm.style.display = 'none';
  clearMessages();
});

signupTab.addEventListener('click', () => {
  signupTab.classList.add('active');
  loginTab.classList.remove('active');
  signupForm.style.display = 'block';
  loginForm.style.display = 'none';
  clearMessages();
});

function clearMessages() {
  loginMessage.className = 'message';
  loginMessage.textContent = '';
  signupMessage.className = 'message';
  signupMessage.textContent = '';
}

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
}

function setLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner"></span>';
  } else {
    button.disabled = false;
    button.textContent = button.id === 'login-btn' ? 'Login' : 'Create Account';
  }
}

// Check if user is logged in
async function checkAuth() {
  const result = await chrome.storage.local.get(['clippo_user_id', 'clippo_user_email', 'clippo_access_token']);

  if (result.clippo_user_id && result.clippo_access_token) {
    showLoggedIn(result.clippo_user_email || 'User');
  } else {
    showLoggedOut();
  }
}

function showLoggedIn(email) {
  loggedOutEl.style.display = 'none';
  loggedInEl.style.display = 'block';
  userEmailEl.textContent = email;
}

function showLoggedOut() {
  loggedOutEl.style.display = 'block';
  loggedInEl.style.display = 'none';
}

// Handle successful auth
async function handleAuthSuccess(data) {
  const userId = data.user.id;
  const email = data.user.email;
  const accessToken = data.access_token;

  // Save to chrome.storage.local
  await chrome.storage.local.set({
    clippo_user_id: userId,
    clippo_user_email: email,
    clippo_access_token: accessToken,
    clippo_refresh_token: data.refresh_token
  });

  showLoggedIn(email);
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showMessage(loginMessage, 'Please fill in all fields', 'error');
    return;
  }

  setLoading(loginBtn, true);

  try {
    const data = await supabaseAuth('token?grant_type=password', {
      email,
      password
    });

    showMessage(loginMessage, 'Login successful!', 'success');
    await handleAuthSuccess(data);

  } catch (error) {
    showMessage(loginMessage, error.message, 'error');
  } finally {
    setLoading(loginBtn, false);
  }
});

// Signup
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;

  if (!email || !password || !confirm) {
    showMessage(signupMessage, 'Please fill in all fields', 'error');
    return;
  }

  if (password !== confirm) {
    showMessage(signupMessage, 'Passwords do not match', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage(signupMessage, 'Password must be at least 6 characters', 'error');
    return;
  }

  setLoading(signupBtn, true);

  try {
    const data = await supabaseAuth('signup', {
      email,
      password
    });

    if (data.user && !data.session) {
      // Email confirmation required
      showMessage(signupMessage, 'Check your email for confirmation link!', 'success');
    } else if (data.access_token) {
      // Auto-confirmed
      showMessage(signupMessage, 'Account created!', 'success');
      await handleAuthSuccess(data);
    }

  } catch (error) {
    showMessage(signupMessage, error.message, 'error');
  } finally {
    setLoading(signupBtn, false);
  }
});

// Open Archive
openArchiveBtn.addEventListener('click', async () => {
  const result = await chrome.storage.local.get(['clippo_user_id']);
  const userId = result.clippo_user_id;

  if (userId) {
    // Open extension archive (web archive requires deployment)
    chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') });
  }
  window.close();
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove([
    'clippo_user_id',
    'clippo_user_email',
    'clippo_access_token',
    'clippo_refresh_token'
  ]);
  showLoggedOut();
});

// Settings
document.getElementById('settings-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  window.close();
});

// Google OAuth - opens web auth page
document.getElementById('google-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://clippo.app/auth/?google=1' });
  window.close();
});

// Forgot password
const resetForm = document.getElementById('reset-form');
const resetBtn = document.getElementById('reset-btn');
const resetMessage = document.getElementById('reset-message');

document.getElementById('forgot-link').addEventListener('click', () => {
  loginForm.style.display = 'none';
  signupForm.style.display = 'none';
  resetForm.style.display = 'block';
  document.querySelector('.tabs').style.display = 'none';
  clearMessages();
  if (resetMessage) {
    resetMessage.className = 'message';
    resetMessage.textContent = '';
  }
});

document.getElementById('back-to-login').addEventListener('click', () => {
  resetForm.style.display = 'none';
  loginForm.style.display = 'block';
  document.querySelector('.tabs').style.display = 'flex';
  loginTab.classList.add('active');
  signupTab.classList.remove('active');
  clearMessages();
});

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resetMessage.className = 'message';
  resetMessage.textContent = '';

  const email = document.getElementById('reset-email').value.trim();
  if (!email) {
    showMessage(resetMessage, 'Please enter your email', 'error');
    return;
  }

  resetBtn.disabled = true;
  resetBtn.textContent = 'Sending...';

  try {
    const redirectTo = encodeURIComponent('https://clippo.app/auth/reset/');
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${redirectTo}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to send reset link');
    }

    showMessage(resetMessage, 'Reset link sent! Check your email.', 'success');
  } catch (error) {
    showMessage(resetMessage, error.message, 'error');
  } finally {
    resetBtn.disabled = false;
    resetBtn.textContent = 'Send Reset Link';
  }
});

// Theme toggle
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('clippo_theme', next);
  chrome.storage.local.set({ clippo_theme: next });
});

// Initialize
checkAuth();
