// auth.js - Supabase Authentication for VideoMark

// Supabase credentials
const SUPABASE_URL = 'https://phnfwoqyyqnqmmteygnb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobmZ3b3F5eXFucW1tdGV5Z25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTQwNjQsImV4cCI6MjA4MjQzMDA2NH0.j_9AV-MeZXhRdlrn-O9mMdvgvokSXexUnKIS2r9mljc';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const loginMessage = document.getElementById('login-message');
const signupMessage = document.getElementById('signup-message');
const googleBtn = document.getElementById('google-btn');

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
    button.innerHTML = '<span class="loading-spinner"></span>Please wait...';
  } else {
    button.disabled = false;
    button.textContent = button.id === 'login-btn' ? 'Login' : 'Create Account';
  }
}

// Handle successful authentication
async function handleAuthSuccess(user) {
  // Store user ID in localStorage for archive page
  localStorage.setItem('videomark_user_id', user.id);
  localStorage.setItem('videomark_user_email', user.email);

  // Redirect to archive with user ID
  window.location.href = `../archive/?uid=${user.id}`;
}

// Check if user is already logged in
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    handleAuthSuccess(session.user);
  }
}

// Login with email/password
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    showMessage(loginMessage, 'Login successful! Redirecting...', 'success');
    await handleAuthSuccess(data.user);

  } catch (error) {
    showMessage(loginMessage, error.message || 'Login failed', 'error');
  } finally {
    setLoading(loginBtn, false);
  }
});

// Sign up with email/password
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    if (data.user && !data.session) {
      // Email confirmation required
      showMessage(signupMessage, 'Check your email for the confirmation link!', 'success');
    } else if (data.session) {
      // Auto-confirmed (if email confirmation is disabled in Supabase)
      showMessage(signupMessage, 'Account created! Redirecting...', 'success');
      await handleAuthSuccess(data.user);
    }

  } catch (error) {
    showMessage(signupMessage, error.message || 'Signup failed', 'error');
  } finally {
    setLoading(signupBtn, false);
  }
});

// Google OAuth login
googleBtn.addEventListener('click', async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/archive/'
      }
    });

    if (error) throw error;

  } catch (error) {
    showMessage(loginMessage, error.message || 'Google login failed', 'error');
  }
});

// Listen for auth state changes (handles OAuth redirects)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    handleAuthSuccess(session.user);
  }
});

// Check session on page load
checkSession();
