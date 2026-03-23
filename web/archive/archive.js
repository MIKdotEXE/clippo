// archive.js - Web Archive for VideoMark (Supabase)

// Supabase credentials
const SUPABASE_URL = 'https://phnfwoqyyqnqmmteygnb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobmZ3b3F5eXFucW1tdGV5Z25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTQwNjQsImV4cCI6MjA4MjQzMDA2NH0.j_9AV-MeZXhRdlrn-O9mMdvgvokSXexUnKIS2r9mljc';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let currentUser = null;
let allClips = [];
let allCategories = [];
let allMacros = [];
let activeMacro = null;
let activeCategory = null;
let searchQuery = '';

// DOM Elements
const categoriesList = document.getElementById('categories-list');
const clipsContainer = document.getElementById('clips-container');
const currentCategoryTitle = document.getElementById('current-category');
const searchInput = document.getElementById('search-input');
const userEmail = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const videoModal = document.getElementById('video-modal');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.getElementById('modal-close');
const videoIframe = document.getElementById('video-iframe');

// Initialize
async function init() {
  // Check for user session
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    // Check URL for uid parameter (from extension)
    const urlParams = new URLSearchParams(window.location.search);
    const uid = urlParams.get('uid');

    if (!uid) {
      // Redirect to login
      window.location.href = '../auth/';
      return;
    }

    // Store uid for extension flow
    localStorage.setItem('videomark_user_id', uid);
  } else {
    currentUser = session.user;
    localStorage.setItem('videomark_user_id', currentUser.id);
    localStorage.setItem('videomark_user_email', currentUser.email);
  }

  // Set user email display
  const email = localStorage.getItem('videomark_user_email') || 'User';
  userEmail.textContent = email;

  // Load data
  await loadData();

  // Setup event listeners
  setupEventListeners();
}

// Load clips, categories, and macros from Supabase
async function loadData() {
  const userId = localStorage.getItem('videomark_user_id');

  if (!userId) {
    window.location.href = '../auth/';
    return;
  }

  try {
    // Load clips
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (clipsError) throw clipsError;
    allClips = clips || [];

    // Load categories
    const { data: categories, error: catsError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId);

    if (catsError) throw catsError;
    allCategories = categories || [];

    // Load macro categories
    const { data: macros, error: macrosError } = await supabase
      .from('macro_categories')
      .select('*')
      .eq('user_id', userId);

    if (macrosError) throw macrosError;
    allMacros = macros?.map(m => m.name) || [];

    // Ensure "Others" exists
    if (!allMacros.includes('Others')) {
      allMacros.unshift('Others');
    }

    renderCategories();
    renderClips();

  } catch (error) {
    console.error('Error loading data:', error);
    clipsContainer.innerHTML = `
      <div class="empty-state">
        <h3>Error loading clips</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Render categories sidebar
function renderCategories() {
  let html = '';

  // "All Clips" option
  html += `
    <div class="macro-item ${!activeMacro && !activeCategory ? 'active' : ''}" data-macro="all">
      <span>All Clips</span>
      <span class="count">${allClips.length}</span>
    </div>
  `;

  // Group categories by macro
  allMacros.forEach(macro => {
    const macroClips = allClips.filter(c => c.macro === macro);
    const macroCategories = allCategories.filter(c => c.macro === macro);

    if (macroClips.length === 0 && macroCategories.length === 0 && macro !== 'Others') return;

    html += `
      <div class="macro-item ${activeMacro === macro ? 'active' : ''}" data-macro="${macro}">
        <span>${macro}</span>
        <span class="count">${macroClips.length}</span>
      </div>
    `;

    // Categories under this macro
    const uniqueCats = [...new Set(macroClips.map(c => c.cat))];
    uniqueCats.forEach(cat => {
      const catClips = macroClips.filter(c => c.cat === cat);
      html += `
        <div class="category-item ${activeCategory === cat ? 'active' : ''}" data-category="${cat}" data-macro="${macro}">
          ${cat} (${catClips.length})
        </div>
      `;
    });
  });

  categoriesList.innerHTML = html;

  // Add click handlers
  categoriesList.querySelectorAll('.macro-item').forEach(item => {
    item.addEventListener('click', () => {
      const macro = item.dataset.macro;
      if (macro === 'all') {
        activeMacro = null;
        activeCategory = null;
        currentCategoryTitle.textContent = 'All Clips';
      } else {
        activeMacro = macro;
        activeCategory = null;
        currentCategoryTitle.textContent = macro;
      }
      renderCategories();
      renderClips();
    });
  });

  categoriesList.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      activeMacro = item.dataset.macro;
      activeCategory = item.dataset.category;
      currentCategoryTitle.textContent = `${activeMacro} / ${activeCategory}`;
      renderCategories();
      renderClips();
    });
  });
}

// Render clips grid
function renderClips() {
  let filteredClips = [...allClips];

  // Filter by macro
  if (activeMacro) {
    filteredClips = filteredClips.filter(c => c.macro === activeMacro);
  }

  // Filter by category
  if (activeCategory) {
    filteredClips = filteredClips.filter(c => c.cat === activeCategory);
  }

  // Filter by search
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredClips = filteredClips.filter(c =>
      c.title.toLowerCase().includes(query) ||
      c.cat.toLowerCase().includes(query) ||
      c.macro.toLowerCase().includes(query)
    );
  }

  if (filteredClips.length === 0) {
    clipsContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
        <h3>No clips found</h3>
        <p>${searchQuery ? 'Try a different search term' : 'Save clips from YouTube to see them here'}</p>
      </div>
    `;
    return;
  }

  let html = '<div class="clips-grid">';

  filteredClips.forEach(clip => {
    html += buildClipCard(clip);
  });

  html += '</div>';
  clipsContainer.innerHTML = html;

  // Add event handlers
  clipsContainer.querySelectorAll('.clip-card').forEach(card => {
    const clipId = card.dataset.clipId;
    const clip = allClips.find(c => c.id === clipId);

    // Thumbnail click - open modal
    card.querySelector('.clip-thumbnail').addEventListener('click', () => {
      openVideoModal(clip);
    });

    // Watch button
    card.querySelector('.watch-btn').addEventListener('click', () => {
      openVideoModal(clip);
    });

    // Edit button
    card.querySelector('.edit-btn').addEventListener('click', () => {
      editClip(clip);
    });

    // Delete button
    card.querySelector('.delete-btn').addEventListener('click', () => {
      deleteClip(clip);
    });
  });
}

// Build clip card HTML
function buildClipCard(clip) {
  const thumbnailUrl = `https://img.youtube.com/vi/${clip.video_id}/mqdefault.jpg`;

  return `
    <div class="clip-card" data-clip-id="${clip.id}">
      <div class="clip-thumbnail">
        <img src="${thumbnailUrl}" alt="${escapeHtml(clip.title)}">
        <div class="play-overlay">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <div class="clip-info">
        <div class="clip-title">${escapeHtml(clip.title)}</div>
        <div class="clip-meta">
          <span class="clip-category">${escapeHtml(clip.cat)}</span>
          <span class="clip-time">${clip.start_time}s - ${clip.end_time}s</span>
        </div>
      </div>
      <div class="clip-actions">
        <button class="clip-btn primary watch-btn">Watch</button>
        <button class="clip-btn secondary edit-btn">Edit</button>
        <button class="clip-btn danger delete-btn">Delete</button>
      </div>
    </div>
  `;
}

// Open video modal with YouTube embed
function openVideoModal(clip) {
  modalTitle.textContent = clip.title;

  // Create YouTube embed URL with start time
  const embedUrl = `https://www.youtube.com/embed/${clip.video_id}?start=${clip.start_time}&autoplay=1`;
  videoIframe.src = embedUrl;

  videoModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close video modal
function closeVideoModal() {
  videoModal.classList.remove('active');
  videoIframe.src = '';
  document.body.style.overflow = '';
}

// Edit clip
async function editClip(clip) {
  const newTitle = prompt('Edit clip title:', clip.title);
  if (newTitle === null || newTitle.trim() === '') return;

  const userId = localStorage.getItem('videomark_user_id');

  try {
    const { error } = await supabase
      .from('clips')
      .update({ title: newTitle.trim() })
      .eq('id', clip.id)
      .eq('user_id', userId);

    if (error) throw error;

    // Update local state
    clip.title = newTitle.trim();
    renderClips();

  } catch (error) {
    alert('Error updating clip: ' + error.message);
  }
}

// Delete clip
async function deleteClip(clip) {
  if (!confirm(`Delete "${clip.title}"?`)) return;

  const userId = localStorage.getItem('videomark_user_id');

  try {
    const { error } = await supabase
      .from('clips')
      .delete()
      .eq('id', clip.id)
      .eq('user_id', userId);

    if (error) throw error;

    // Update local state
    allClips = allClips.filter(c => c.id !== clip.id);
    renderCategories();
    renderClips();

  } catch (error) {
    alert('Error deleting clip: ' + error.message);
  }
}

// Logout
async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('videomark_user_id');
  localStorage.removeItem('videomark_user_email');
  window.location.href = '../auth/';
}

// Setup event listeners
function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderClips();
  });

  // Logout
  logoutBtn.addEventListener('click', logout);

  // Modal close
  modalClose.addEventListener('click', closeVideoModal);

  videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) {
      closeVideoModal();
    }
  });

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && videoModal.classList.contains('active')) {
      closeVideoModal();
    }
  });
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start
init();
