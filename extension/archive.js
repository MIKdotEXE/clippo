document.addEventListener("DOMContentLoaded", () => {
  let clips = [];
  let categories = [];
  let macroCats = [];
  let activeFilter = null; // { type: 'macro' | 'cat', value: string } or null for all
  let searchText = "";
  let expandedCardId = null;

  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggleSidebar");
  const clipsGrid = document.getElementById("clipsGrid");
  const searchInput = document.getElementById("searchInput");
  const filterInfo = document.getElementById("filterInfo");
  const filterLabel = document.getElementById("filterLabel");
  const clearFilterBtn = document.getElementById("clearFilter");
  const sidebarGroups = document.getElementById("sidebarGroups");
  const macroList = document.getElementById("macroList");
  const categoryList = document.getElementById("categoryList");
  const newMacroInput = document.getElementById("newMacroInput");
  const newCatInput = document.getElementById("newCategoryInput");
  const newCatIconInput = document.getElementById("newCategoryIconInput");
  const addMacroBtn = document.getElementById("addMacroBtn");
  const addCategoryBtn = document.getElementById("addCategoryBtn");
  const categoryCardsContainer = document.getElementById("categoryCards");

  // Sidebar toggle
  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    document.getElementById("main").classList.toggle("shifted");
  });

  // Logout - notify background to clear auth on all tabs
  document.getElementById("logoutBtn").addEventListener("click", () => {
    if (confirm("Are you sure you want to logout?")) {
      chrome.runtime.sendMessage({ action: "logout" }, () => {
        window.close();
      });
    }
  });

  // Search
  searchInput.addEventListener("input", (e) => {
    searchText = e.target.value.toLowerCase();
    renderClips();
  });

  // Clear filter
  clearFilterBtn.addEventListener("click", () => {
    activeFilter = null;
    updateFilterUI();
    renderClips();
    renderCategoryCards();
    renderSidebar();
  });

  // Add macro
  addMacroBtn.addEventListener("click", () => {
    const name = newMacroInput.value.trim();
    if (!name) return alert("Enter a macro name");
    if (macroCats.includes(name)) return alert("Macro already exists");
    macroCats.push(name);
    saveCategories();
    newMacroInput.value = "";
  });

  // Add category
  addCategoryBtn.addEventListener("click", () => {
    const name = newCatInput.value.trim();
    if (!name) return alert("Enter a category name");
    if (categories.some(c => c.name === name)) return alert("Category already exists");

    const iconUrl = newCatIconInput.value.trim();
    // Validate icon URL if provided
    if (iconUrl && !iconUrl.startsWith('https://')) {
      return alert("Icon URL must start with https://");
    }

    const macro = prompt(`Select macro for "${name}":\n${macroCats.join(", ")}`, macroCats[0] || "Others");
    if (!macro) return;

    if (!macroCats.includes(macro)) {
      macroCats.push(macro);
    }
    categories.push({ name, icon: iconUrl || null, macro });
    saveCategories();
    newCatInput.value = "";
    newCatIconInput.value = "";
  });

  // Listen for messages from clippo.app/player
  window.addEventListener("message", (e) => {
    if (e.origin !== "https://clippo.app") return;
    if (e.data.type === "videoEnded") {
      const clipId = String(e.data.clipId).replace(/[^\w-]/g, "");
      const card = document.querySelector(`.clip-card[data-id="${clipId}"]`);
      if (card) {
        card.querySelector(".video-ended-overlay")?.classList.add("show");
      }
    }
  });

  // Load data
  chrome.storage.sync.get({
    clips: [],
    categories: [],
    macroCategories: ["Others"]
  }, (data) => {
    macroCats = data.macroCategories.slice();
    if (!macroCats.includes("Others")) macroCats.unshift("Others");

    categories = data.categories.map(c =>
      (c && c.name) ? c : { name: c, icon: null, macro: "Others" }
    );
    if (!categories.some(c => c.name === "Others")) {
      categories.push({ name: "Others", icon: null, macro: "Others" });
    }

    clips = data.clips.map((c, i) => ({
      id: i,
      videoId: c.videoId,
      title: c.title,
      start: c.start,
      end: c.end,
      macro: c.macro || "Others",
      cat: c.cat || "Others"
    }));

    updateDataLists();
    renderCategoryCards();
    renderSidebar();
    renderClips();
  });

  function saveClips() {
    const toSave = clips.map(c => ({
      videoId: c.videoId,
      title: c.title,
      start: c.start,
      end: c.end,
      macro: c.macro,
      cat: c.cat
    }));
    chrome.storage.sync.set({ clips: toSave });
  }

  function saveCategories() {
    chrome.storage.sync.set({
      categories,
      macroCategories: macroCats
    }, () => {
      updateDataLists();
      renderCategoryCards();
      renderSidebar();
    });
  }

  function updateDataLists() {
    macroList.innerHTML = "";
    macroCats.forEach(m => {
      const o = document.createElement("option");
      o.value = m;
      macroList.appendChild(o);
    });
    categoryList.innerHTML = "";
    categories.forEach(c => {
      const o = document.createElement("option");
      o.value = c.name;
      categoryList.appendChild(o);
    });
  }

  function updateFilterUI() {
    if (activeFilter) {
      filterInfo.style.display = "flex";
      filterLabel.textContent = activeFilter.type === "macro"
        ? `Macro: ${activeFilter.value}`
        : `Category: ${activeFilter.value}`;
    } else {
      filterInfo.style.display = "none";
    }
  }

  function renderSidebar() {
    sidebarGroups.innerHTML = "";

    macroCats.forEach(macro => {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.className = "macro-summary";

      const macroSpan = document.createElement("span");
      macroSpan.textContent = macro;

      const actions = document.createElement("div");
      actions.className = "actions";

      if (macro !== "Others") {
        const renameBtn = document.createElement("button");
        renameBtn.innerHTML = "✎";
        renameBtn.title = "Rename";
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const newName = prompt("New macro name:", macro)?.trim();
          if (newName && newName !== macro && !macroCats.includes(newName)) {
            macroCats[macroCats.indexOf(macro)] = newName;
            categories.forEach(c => { if (c.macro === macro) c.macro = newName; });
            clips.forEach(c => { if (c.macro === macro) c.macro = newName; });
            saveCategories();
            saveClips();
          }
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = "×";
        deleteBtn.title = "Delete";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm(`Delete macro "${macro}"? Categories will move to Others.`)) {
            macroCats = macroCats.filter(m => m !== macro);
            categories.forEach(c => { if (c.macro === macro) c.macro = "Others"; });
            clips.forEach(c => { if (c.macro === macro) c.macro = "Others"; });
            saveCategories();
            saveClips();
          }
        });

        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);
      }

      summary.appendChild(macroSpan);
      summary.appendChild(actions);

      // Click on macro name to filter
      macroSpan.addEventListener("click", (e) => {
        e.stopPropagation();
        activeFilter = { type: "macro", value: macro };
        updateFilterUI();
        renderClips();
        renderSidebar();
      });

      details.appendChild(summary);

      // Categories under this macro
      const macroCategories = categories.filter(c => c.macro === macro);
      macroCategories.forEach(cat => {
        const item = document.createElement("div");
        item.className = "category-item";
        if (activeFilter?.type === "cat" && activeFilter.value === cat.name) {
          item.classList.add("active");
        }

        const catNameContainer = document.createElement("div");
        catNameContainer.className = "cat-name";

        // Icon or placeholder
        if (cat.icon && cat.icon.startsWith('https://')) {
          const iconImg = document.createElement("img");
          iconImg.className = "cat-icon";
          iconImg.src = cat.icon;
          iconImg.alt = cat.name;
          iconImg.onerror = () => {
            iconImg.style.display = "none";
          };
          catNameContainer.appendChild(iconImg);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "cat-icon-placeholder";
          placeholder.textContent = cat.name.charAt(0).toUpperCase();
          catNameContainer.appendChild(placeholder);
        }

        const catSpan = document.createElement("span");
        catSpan.textContent = cat.name;
        catNameContainer.appendChild(catSpan);

        catNameContainer.addEventListener("click", () => {
          activeFilter = { type: "cat", value: cat.name };
          updateFilterUI();
          renderClips();
          renderSidebar();
        });

        const catActions = document.createElement("div");
        catActions.className = "actions";

        if (cat.name !== "Others") {
          // Edit icon button
          const iconBtn = document.createElement("button");
          iconBtn.innerHTML = "🖼";
          iconBtn.title = "Set icon";
          iconBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const newIcon = prompt("Enter icon URL (https://...):", cat.icon || "")?.trim();
            if (newIcon !== null) {
              if (newIcon && !newIcon.startsWith('https://')) {
                alert("Icon URL must start with https://");
                return;
              }
              cat.icon = newIcon || null;
              saveCategories();
            }
          });

          const renameBtn = document.createElement("button");
          renameBtn.innerHTML = "✎";
          renameBtn.title = "Rename";
          renameBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const newName = prompt("New category name:", cat.name)?.trim();
            if (newName && newName !== cat.name && !categories.some(c => c.name === newName)) {
              clips.forEach(c => { if (c.cat === cat.name) c.cat = newName; });
              cat.name = newName;
              saveCategories();
              saveClips();
            }
          });

          const deleteBtn = document.createElement("button");
          deleteBtn.innerHTML = "×";
          deleteBtn.title = "Delete";
          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`Delete category "${cat.name}"? Clips will move to Others.`)) {
              clips.forEach(c => { if (c.cat === cat.name) c.cat = "Others"; });
              categories = categories.filter(c => c.name !== cat.name);
              saveCategories();
              saveClips();
            }
          });

          catActions.appendChild(iconBtn);
          catActions.appendChild(renameBtn);
          catActions.appendChild(deleteBtn);
        }

        item.appendChild(catNameContainer);
        item.appendChild(catActions);
        details.appendChild(item);
      });

      sidebarGroups.appendChild(details);
    });
  }

  function renderCategoryCards() {
    categoryCardsContainer.innerHTML = "";

    categories.forEach(cat => {
      const clipCount = clips.filter(c => c.cat === cat.name).length;

      const card = document.createElement("div");
      card.className = "category-card";
      if (activeFilter?.type === "cat" && activeFilter.value === cat.name) {
        card.classList.add("active");
      }

      // Icon (only if set, no placeholder)
      if (cat.icon && cat.icon.startsWith('https://')) {
        const iconImg = document.createElement("img");
        iconImg.className = "cat-card-icon";
        iconImg.src = cat.icon;
        iconImg.alt = cat.name;
        iconImg.onerror = () => {
          iconImg.style.display = "none";
        };
        card.appendChild(iconImg);
      }

      // Category name
      const nameSpan = document.createElement("span");
      nameSpan.className = "cat-card-name";
      nameSpan.textContent = cat.name;
      card.appendChild(nameSpan);

      // Clip count
      const countSpan = document.createElement("span");
      countSpan.className = "cat-card-count";
      countSpan.textContent = `${clipCount}`;
      card.appendChild(countSpan);

      // Actions (only for non-Others categories)
      if (cat.name !== "Others") {
        const actions = document.createElement("div");
        actions.className = "cat-card-actions";

        // Set icon button
        const iconBtn = document.createElement("button");
        iconBtn.title = "Set icon";
        iconBtn.textContent = "🖼";
        iconBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const newIcon = prompt("Enter icon URL (https://...):", cat.icon || "")?.trim();
          if (newIcon !== null) {
            if (newIcon && !newIcon.startsWith('https://')) {
              alert("Icon URL must start with https://");
              return;
            }
            cat.icon = newIcon || null;
            saveCategories();
            renderCategoryCards();
          }
        });
        actions.appendChild(iconBtn);

        // Rename button
        const renameBtn = document.createElement("button");
        renameBtn.title = "Rename";
        renameBtn.textContent = "✎";
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const newName = prompt("New category name:", cat.name)?.trim();
          if (newName && newName !== cat.name && !categories.some(c => c.name === newName)) {
            clips.forEach(c => { if (c.cat === cat.name) c.cat = newName; });
            cat.name = newName;
            saveCategories();
            saveClips();
            renderCategoryCards();
          }
        });
        actions.appendChild(renameBtn);

        // Delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.title = "Delete";
        deleteBtn.textContent = "×";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm(`Delete category "${cat.name}"? Clips will move to Others.`)) {
            clips.forEach(c => { if (c.cat === cat.name) c.cat = "Others"; });
            categories = categories.filter(c => c.name !== cat.name);
            saveCategories();
            saveClips();
            renderCategoryCards();
          }
        });
        actions.appendChild(deleteBtn);

        card.appendChild(actions);
      }

      // Click to filter
      card.addEventListener("click", () => {
        if (activeFilter?.type === "cat" && activeFilter.value === cat.name) {
          activeFilter = null;
        } else {
          activeFilter = { type: "cat", value: cat.name };
        }
        updateFilterUI();
        renderClips();
        renderCategoryCards();
        renderSidebar();
      });

      categoryCardsContainer.appendChild(card);
    });
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function renderClips() {
    let filtered = clips.slice();

    // Apply filter
    if (activeFilter) {
      if (activeFilter.type === "macro") {
        filtered = filtered.filter(c => c.macro === activeFilter.value);
      } else if (activeFilter.type === "cat") {
        filtered = filtered.filter(c => c.cat === activeFilter.value);
      }
    }

    // Apply search
    if (searchText) {
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(searchText) ||
        c.cat.toLowerCase().includes(searchText) ||
        c.macro.toLowerCase().includes(searchText)
      );
    }

    // Sort by most recent
    filtered = filtered.reverse();

    if (filtered.length === 0) {
      clipsGrid.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="20" height="20" rx="2"/>
            <path d="M10 8l6 4-6 4V8z"/>
          </svg>
          <h3>No clips found</h3>
          <p>Save clips from YouTube to see them here</p>
        </div>
      `;
      return;
    }

    clipsGrid.innerHTML = filtered.map(clip => buildCardHTML(clip)).join("");

    // Attach event handlers
    filtered.forEach(clip => {
      const card = clipsGrid.querySelector(`.clip-card[data-id="${clip.id}"]`);
      if (!card) return;

      // Play button / thumbnail click
      const playBtn = card.querySelector(".btn-play");
      const thumb = card.querySelector(".card-thumb");

      const expandCard = () => {
        // Collapse any other expanded card
        if (expandedCardId !== null && expandedCardId !== clip.id) {
          const oldCard = clipsGrid.querySelector(`.clip-card[data-id="${expandedCardId}"]`);
          if (oldCard) collapseCard(oldCard);
        }

        card.classList.add("expanded");
        expandedCardId = clip.id;

        // Load video with cache-busting timestamp to prevent black screen
        const iframe = card.querySelector("iframe");
        iframe.src = `https://clippo.app/player/?v=${clip.videoId}&start=${clip.start}&end=${clip.end}&clipId=${clip.id}&t=${Date.now()}`;

        // Scroll to card
        card.scrollIntoView({ behavior: "smooth", block: "start" });
      };

      playBtn?.addEventListener("click", expandCard);
      thumb?.addEventListener("click", expandCard);

      // Replay button
      card.querySelector(".btn-replay")?.addEventListener("click", () => {
        card.querySelector(".video-ended-overlay")?.classList.remove("show");
        const iframe = card.querySelector("iframe");
        // Add timestamp to force reload
        iframe.src = `https://clippo.app/player/?v=${clip.videoId}&start=${clip.start}&end=${clip.end}&clipId=${clip.id}&t=${Date.now()}`;
      });

      // Collapse button
      card.querySelector(".btn-collapse")?.addEventListener("click", () => {
        collapseCard(card);
      });

      // Share button
      card.querySelector(".btn-share")?.addEventListener("click", () => {
        const playerUrl = `https://clippo.app/player/?v=${clip.videoId}&start=${clip.start}&end=${clip.end}`;
        const shareText = `${clip.title} - Clippo Clip`;

        if (navigator.share) {
          navigator.share({ title: shareText, url: playerUrl }).catch(() => {});
        } else {
          navigator.clipboard.writeText(playerUrl).then(() => {
            const btn = card.querySelector(".btn-share");
            const origHTML = btn.innerHTML;
            btn.textContent = "Copied!";
            setTimeout(() => { btn.innerHTML = origHTML; }, 1500);
          });
        }
      });

      // Delete button
      card.querySelector(".btn-delete")?.addEventListener("click", () => {
        if (confirm("Delete this clip?")) {
          clips = clips.filter(c => c.id !== clip.id);
          saveClips();
          renderClips();
        }
      });

      // Editable fields
      setupEditableField(card, clip, "title", ".title-field");
      setupEditableField(card, clip, "macro", ".macro-field");
      setupEditableField(card, clip, "cat", ".cat-field");
    });
  }

  function collapseCard(card) {
    card.classList.remove("expanded");
    card.querySelector(".video-ended-overlay")?.classList.remove("show");
    const iframe = card.querySelector("iframe");
    iframe.src = "";
    expandedCardId = null;
  }

  function setupEditableField(card, clip, field, selector) {
    const input = card.querySelector(selector);
    if (!input) return;

    input.addEventListener("blur", () => {
      const newValue = input.value.trim();
      if (newValue && newValue !== clip[field]) {
        clip[field] = newValue;

        // Add new macro/category if needed
        if (field === "macro" && !macroCats.includes(newValue)) {
          macroCats.push(newValue);
          saveCategories();
        }
        if (field === "cat" && !categories.some(c => c.name === newValue)) {
          categories.push({ name: newValue, icon: null, macro: clip.macro });
          saveCategories();
        }

        saveClips();
        renderSidebar();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });
  }

  function buildCardHTML(clip) {
    const isExpanded = expandedCardId === clip.id;

    return `
      <div class="clip-card ${isExpanded ? 'expanded' : ''}" data-id="${clip.id}">
        <div class="card-thumb">
          <img src="https://img.youtube.com/vi/${clip.videoId}/mqdefault.jpg" alt="${escapeHtml(clip.title)}"/>
          <div class="play-overlay">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <span class="time-badge">${formatTime(clip.start)} - ${formatTime(clip.end)}</span>
        </div>

        <div class="video-container">
          <div class="video-wrapper">
            <iframe src="" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
          <div class="video-ended-overlay">
            <p>Clip ended</p>
            <button class="btn-replay">Watch Again</button>
            <button class="btn-collapse">Close</button>
          </div>
        </div>

        <div class="card-body">
          <div class="editable-field">
            <label>Title</label>
            <input type="text" class="value title-field" value="${escapeHtml(clip.title)}"/>
          </div>
          <div class="editable-field">
            <label>Macro</label>
            <input type="text" class="value macro-field" list="macroList" value="${escapeHtml(clip.macro)}"/>
          </div>
          <div class="editable-field">
            <label>Category</label>
            <input type="text" class="value cat-field" list="categoryList" value="${escapeHtml(clip.cat)}"/>
          </div>

          <div class="card-actions">
            <button class="btn-play">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Watch Clip
            </button>
            <button class="btn-share" title="Share">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
            <button class="btn-delete" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});
