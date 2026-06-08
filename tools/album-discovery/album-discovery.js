/**
 * World Album Discovery — Client Logic
 *
 * State machine: ONBOARDING → DASHBOARD → SESSION
 * All API calls go to /api/album-discovery/* (same origin, handled by Cloudflare Pages Functions).
 */

// ───── Global Modal Functions ─────
window.openModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
};

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
};

(function () {
  'use strict';

  // ───── State ─────
  let currentUser = null;
  let currentMode = null; // 'daily' | 'discover' | 'world-tour' | 'hidden-gem'
  let currentAlbum = null;
  let historyData = { liked: [], disliked: [], skipped: [] };
  let activeHistoryTab = 'liked';
  let filtersLoaded = false;

  // ───── Country → Flag Emoji ─────
  function countryFlag(code) {
    if (!code || code.length !== 2) return '';
    const offset = 127397;
    return String.fromCodePoint(
      code.toUpperCase().charCodeAt(0) + offset,
      code.toUpperCase().charCodeAt(1) + offset
    );
  }

  // Country code → readable name (subset)
  const COUNTRY_NAMES = {
    JP: 'Japan', KR: 'South Korea', IN: 'India', PK: 'Pakistan',
    TR: 'Turkey', ID: 'Indonesia', TH: 'Thailand', PH: 'Philippines',
    NG: 'Nigeria', GH: 'Ghana', ZA: 'South Africa', EG: 'Egypt',
    ET: 'Ethiopia', SN: 'Senegal', ML: 'Mali',
    BR: 'Brazil', AR: 'Argentina', MX: 'Mexico', CO: 'Colombia',
    CU: 'Cuba', US: 'United States', CA: 'Canada',
    FR: 'France', DE: 'Germany', SE: 'Sweden', GB: 'United Kingdom',
    PT: 'Portugal', GR: 'Greece', RS: 'Serbia',
    AU: 'Australia', NZ: 'New Zealand',
  };

  function countryName(code) {
    return COUNTRY_NAMES[code] || code;
  }

  // ───── API Client ─────
  async function api(path, options = {}) {
    // Bypass Cloudflare Edge caching for dynamic data
    if ((!options.method || options.method === 'GET') && !path.includes('/api/album-discovery/filters')) {
      const separator = path.includes('?') ? '&' : '?';
      path += `${separator}_t=${Date.now()}`;
    }

    console.log(`[API Request] ${options.method || 'GET'} ${path}`, options.body ? JSON.parse(options.body) : '');

    const res = await fetch(path, {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store',
      ...options,
    });
    const data = await res.json();
    
    console.log(`[API Response] ${res.status}`, data);

    if (!res.ok && !data.noResults) {
      throw new Error(data.error || `API error: ${res.status}`);
    }
    return data;
  }

  // ───── DOM Helpers ─────
  function $(id) {
    return document.getElementById(id);
  }

  function showView(viewId) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const view = $(viewId);
    view.classList.add('active');
    // Re-trigger animation
    view.style.animation = 'none';
    view.offsetHeight; // reflow
    view.style.animation = '';
  }

  // ───── VIEW 1: ONBOARDING ─────
  function initOnboarding() {
    const form = $('username-form');
    const input = $('username-input');
    const errorEl = $('username-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';

      const username = input.value.trim();
      if (!username) {
        errorEl.textContent = 'Please enter a username.';
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        errorEl.textContent = '3–20 chars: letters, numbers, underscores only.';
        return;
      }

      try {
        const data = await api('/api/album-discovery/user', {
          method: 'POST',
          body: JSON.stringify({ username }),
        });
        currentUser = data.user.username;
        localStorage.setItem('wad_username', currentUser);
        enterDashboard();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });

    // Auto-login if username saved
    const saved = localStorage.getItem('wad_username');
    if (saved) {
      input.value = saved;
    }
  }

  // ───── VIEW 2: DASHBOARD ─────
  async function enterDashboard() {
    showView('view-dashboard');
    $('dash-username').textContent = currentUser;
    $('dash-passport').textContent = 'Loading...';

    // Fetch stats + history in parallel
    try {
      const [stats, history] = await Promise.all([
        api(`/api/album-discovery/stats?username=${encodeURIComponent(currentUser)}`),
        api(`/api/album-discovery/history?username=${encodeURIComponent(currentUser)}`),
      ]);

      // Passport summary
      const liked = stats.interactions?.liked || 0;
      const total =
        (stats.interactions?.liked || 0) +
        (stats.interactions?.disliked || 0) +
        (stats.interactions?.skipped || 0);
      $('dash-passport').textContent =
        `${countryFlag('🌍')} ${stats.countriesVisited}/${stats.totalCountries} countries · ${total} albums explored · ${stats.genresExplored} genres`;

      // History
      historyData = history;
      renderHistory();
    } catch (err) {
      $('dash-passport').textContent = 'Welcome! Start exploring.';
      historyData = { liked: [], disliked: [], skipped: [] };
      renderHistory();
    }
  }

  function renderHistory() {
    const list = historyData[activeHistoryTab] || [];
    const container = $('history-content');
    const emptyEl = $('history-empty');

    if (list.length === 0) {
      container.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    container.innerHTML = list
      .map(
        (album) => `
        <div class="history-item">
          <div class="history-thumb-fallback">${countryFlag(album.country) || '🎵'}</div>
          <div class="history-info">
            <div class="history-title">${escapeHtml(album.title)}</div>
            <div class="history-meta">${escapeHtml(album.artist_name)} · ${album.release_year || ''} ${countryFlag(album.country)}</div>
          </div>
        </div>`
      )
      .join('');
  }

  function initDashboard() {
    // Mode cards
    $('modes-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.mode-card');
      if (!card) return;
      currentMode = card.dataset.mode;
      enterSession();
    });

    // History tabs
    document.querySelectorAll('.history-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.history-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        activeHistoryTab = tab.dataset.tab;
        renderHistory();
      });
    });

    // Logout
    $('dash-logout').addEventListener('click', () => {
      currentUser = null;
      localStorage.removeItem('wad_username');
      showView('view-onboarding');
    });
  }

  // ───── VIEW 3: DISCOVERY SESSION ─────
  async function enterSession() {
    showView('view-session');

    const filterControls = $('filter-controls');
    const albumCard = $('album-card');
    const loading = $('session-loading');
    const errorEl = $('session-error');

    // Reset
    albumCard.classList.add('hidden');
    errorEl.classList.add('hidden');
    loading.classList.remove('hidden');

    // Show filters only for Filtered Discovery
    if (currentMode === 'discover') {
      filterControls.classList.remove('hidden');
      if (!filtersLoaded) {
        await loadFilters();
      }
      loading.classList.add('hidden');
      // Don't auto-load an album — wait for user to click "Find Album"
      return;
    } else {
      filterControls.classList.add('hidden');
    }

    await fetchAlbumForMode();
  }

  async function loadFilters() {
    try {
      const data = await api('/api/album-discovery/filters');

      const countrySelect = $('filter-country');
      countrySelect.innerHTML = '<option value="">Any Country</option>';
      data.countries.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `${countryFlag(c)} ${countryName(c)}`;
        countrySelect.appendChild(opt);
      });

      const genreSelect = $('filter-genre');
      genreSelect.innerHTML = '<option value="">Any Genre</option>';
      data.genres.forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        genreSelect.appendChild(opt);
      });

      const decadeSelect = $('filter-decade');
      decadeSelect.innerHTML = '<option value="">Any Decade</option>';
      data.decades.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = `${d}s`;
        decadeSelect.appendChild(opt);
      });

      filtersLoaded = true;
    } catch (err) {
      console.error('Failed to load filters:', err);
    }
  }

  async function fetchAlbumForMode() {
    const albumCard = $('album-card');
    const loading = $('session-loading');
    const errorEl = $('session-error');

    albumCard.classList.add('hidden');
    errorEl.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
      let data;
      const user = encodeURIComponent(currentUser);

      switch (currentMode) {
        case 'daily':
          data = await api(`/api/album-discovery/daily?username=${user}`);
          break;
        case 'discover': {
          const country = $('filter-country').value;
          const genre = $('filter-genre').value;
          const decade = $('filter-decade').value;
          let url = `/api/album-discovery/discover?username=${user}`;
          if (country) url += `&country=${encodeURIComponent(country)}`;
          if (genre) url += `&genre=${encodeURIComponent(genre)}`;
          if (decade) url += `&decade=${encodeURIComponent(decade)}`;
          data = await api(url);
          break;
        }
        case 'world-tour':
          data = await api(`/api/album-discovery/world-tour?username=${user}`);
          break;
        case 'hidden-gem':
          data = await api(`/api/album-discovery/hidden-gem?username=${user}`);
          break;
        default:
          throw new Error('Unknown mode');
      }

      if (data.error || data.noResults) {
        loading.classList.add('hidden');
        errorEl.textContent = data.error || 'No albums found.';
        errorEl.classList.remove('hidden');
        return;
      }

      currentAlbum = data.album;
      renderAlbumCard(data.album);
      loading.classList.add('hidden');
      albumCard.classList.remove('hidden');
      // Re-trigger card animation
      albumCard.style.animation = 'none';
      albumCard.offsetHeight;
      albumCard.style.animation = '';
    } catch (err) {
      loading.classList.add('hidden');
      if (err.message && err.message.includes('No')) {
        errorEl.textContent = err.message;
      } else {
        errorEl.textContent = err.message || 'Something went wrong. Try again.';
      }
      errorEl.classList.remove('hidden');
    }
  }

  function renderAlbumCard(album) {
    $('album-title').textContent = album.title;
    $('album-artist').textContent = album.artist_name;
    $('album-year').textContent = album.release_year || '';
    $('album-country').textContent =
      `${countryFlag(album.country)} ${countryName(album.country)}`;

    // Genres
    const genresEl = $('album-genres');
    genresEl.innerHTML = '';
    if (album.genre) {
      album.genre.split(',').forEach((g) => {
        const pill = document.createElement('span');
        pill.className = 'genre-pill';
        pill.textContent = g.trim();
        genresEl.appendChild(pill);
      });
    }

    // Description
    const descEl = $('album-description');
    if (album.description) {
      descEl.textContent = album.description;
      descEl.style.display = '';
    } else {
      descEl.style.display = 'none';
    }

    // Cover art
    const artImg = $('album-art');
    const artFallback = $('album-art-fallback');

    if (album.cover_art_url) {
      artImg.src = album.cover_art_url;
      artImg.alt = `${album.title} cover art`;
      artImg.style.display = '';
      artFallback.classList.add('hidden');

      artImg.onerror = () => {
        artImg.style.display = 'none';
        artFallback.classList.remove('hidden');
      };
    } else {
      artImg.style.display = 'none';
      artFallback.classList.remove('hidden');
    }
  }

  function initSession() {
    // Back button
    $('session-back').addEventListener('click', () => {
      currentAlbum = null;
      currentMode = null;
      enterDashboard();
    });

    // Action buttons (like, dislike, skip)
    document.querySelectorAll('.action-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!currentAlbum || !currentUser) return;

        const status = btn.dataset.action;

        // Disable buttons during request
        document.querySelectorAll('.action-btn').forEach((b) => (b.disabled = true));

        try {
          await api('/api/album-discovery/interact', {
            method: 'POST',
            body: JSON.stringify({
              username: currentUser,
              album_id: currentAlbum.id,
              status,
            }),
          });

          // For daily mode, go back to dashboard after interaction
          if (currentMode === 'daily') {
            currentAlbum = null;
            enterDashboard();
          } else {
            // Fetch next album
            await fetchAlbumForMode();
          }
        } catch (err) {
          console.error('Interaction failed:', err);
          const errorEl = $('session-error');
          errorEl.textContent = `Interaction Error: ${err.message} (Are you sure D1 is bound?)`;
          errorEl.classList.remove('hidden');
        } finally {
          document.querySelectorAll('.action-btn').forEach((b) => (b.disabled = false));
        }
      });
    });

    // Filter apply button
    $('filter-apply').addEventListener('click', () => {
      fetchAlbumForMode();
    });
  }

  // ───── Utilities ─────
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ───── Init ─────
  function init() {
    initOnboarding();
    initDashboard();
    initSession();

    // Check for saved session
    const saved = localStorage.getItem('wad_username');
    if (saved) {
      currentUser = saved;
      // Verify user still exists
      api('/api/album-discovery/user', {
        method: 'POST',
        body: JSON.stringify({ username: saved }),
      })
        .then((data) => {
          currentUser = data.user.username;
          localStorage.setItem('wad_username', currentUser);
          enterDashboard();
        })
        .catch(() => showView('view-onboarding'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
