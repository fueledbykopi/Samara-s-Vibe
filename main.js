import { songs as initialSongs, playlists } from './data.js';

// State
let songs = [...initialSongs];
let currentSongIndex = 0;
let isPlaying = false;
let playbackInterval = null;
let activeBgLayer = 1;
let currentMode = 'audio';
let activeEngine = 'local-audio';
let localUrls = new Set(); 

// Browser State
const BROWSER_CONFIG = {
  defaultSearchEngine: 'https://duckduckgo.com/?q=',
  defaultHome: 'about:home'
};

let tabs = [];
let activeTabId = null;
let downloads = [];

// DOM Elements
const miniPlayer = document.getElementById('miniPlayer');
const nowPlayingDrawer = document.getElementById('nowPlayingDrawer');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const miniArtwork = document.getElementById('miniArtwork');
const fullTitle = document.getElementById('fullTitle');
const fullArtist = document.getElementById('fullArtist');
const fullArtwork = document.getElementById('fullArtwork');
const bgLayer1 = document.getElementById('bgLayer1');
const bgLayer2 = document.getElementById('bgLayer2');
const progressFill = document.getElementById('progressFill');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const mainPlayIcon = document.getElementById('mainPlayIcon');
const miniPlayIcon = document.getElementById('miniPlayIcon');
const lyricsContainer = document.getElementById('lyricsContainer');
const localAudio = document.getElementById('localAudio');
const localVideo = document.getElementById('localVideo');
const videoContainer = document.getElementById('videoContainer');
const artworkContainer = document.getElementById('artworkContainer');
const fileInput = document.getElementById('fileInput');
const browserInput = document.getElementById('browserInput');
const tabsContainer = document.getElementById('tabsContainer');
const tabCountEl = document.getElementById('tabCount');
const tabSwitcher = document.getElementById('tabSwitcher');
const tabGrid = document.getElementById('tabGrid');
const downloadsOverlay = document.getElementById('downloadsOverlay');
const downloadsList = document.getElementById('downloadsList');
const localSearchInput = document.getElementById('localSearchInput');

// Navigation & Settings Elements
const tabViews = document.querySelectorAll('.tab-view');
const navItems = document.querySelectorAll('.nav-item');
const themeToggle = document.getElementById('themeToggle');
const dnsSelect = document.getElementById('dnsSelect');
const toolbarPositionSelect = document.getElementById('toolbarPositionSelect');
const forceZoomToggle = document.getElementById('forceZoomToggle');
const browserToolbar = document.getElementById('browserToolbar');
const browserViewport = document.querySelector('.browser-viewport');


function init() {
  try {
    loadSettings();
    renderLibrary();
    renderPlaylists();
    setupEventListeners();
    setupNavigation();
    setupSwipeGestures();
    setupBrowser();
    updateSongUI(songs[currentSongIndex], true);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (error) {
    console.error("Initialization error:", error);
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.classList.add('hidden');
  }
}

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('samarasVibeSettings')) || {
    theme: 'dark',
    toolbarPosition: 'bottom',
    dns: 'default',
    forceZoom: false
  };

  if (themeToggle) themeToggle.checked = settings.theme === 'dark';
  document.body.classList.toggle('light-theme', settings.theme === 'light');

  if (toolbarPositionSelect) {
    toolbarPositionSelect.value = settings.toolbarPosition;
    updateToolbarPosition(settings.toolbarPosition);
  }

  if (dnsSelect) dnsSelect.value = settings.dns;
  if (forceZoomToggle) forceZoomToggle.checked = settings.forceZoom;
}

function saveSettings() {
  const settings = {
    theme: themeToggle.checked ? 'dark' : 'light',
    toolbarPosition: toolbarPositionSelect.value,
    dns: dnsSelect.value,
    forceZoom: forceZoomToggle.checked
  };
  localStorage.setItem('samarasVibeSettings', JSON.stringify(settings));
}

function updateToolbarPosition(pos) {
  if (pos === 'top') {
    if (browserToolbar) browserToolbar.classList.add('top-position');
    if (browserViewport) browserViewport.classList.add('toolbar-top');
  } else {
    if (browserToolbar) browserToolbar.classList.remove('top-position');
    if (browserViewport) browserViewport.classList.remove('toolbar-top');
  }
}

function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      tabViews.forEach(v => v.classList.remove('active'));

      item.classList.add('active');
      const targetId = item.getAttribute('data-tab');
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add('active');
    });
  });
}

function setupBrowser() {
  if (!browserInput) return;

  // Initial tab
  createNewTab(BROWSER_CONFIG.defaultHome);

  browserInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      let url = browserInput.value.trim();
      if (!url) return;

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.includes('.') && !url.includes(' ')) {
          url = 'https://' + url;
        } else {
          url = BROWSER_CONFIG.defaultSearchEngine + encodeURIComponent(url);
        }
      }
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab) {
        activeTab.url = url;
        activeTab.iframe.src = url;
        switchTab(activeTabId);
      }
    }
  });

  document.getElementById('browserRefresh').addEventListener('click', () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) activeTab.iframe.src = activeTab.iframe.src;
  });

  document.getElementById('browserBack').addEventListener('click', () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) activeTab.iframe.contentWindow.history.back();
  });

  document.getElementById('browserForward').addEventListener('click', () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) activeTab.iframe.contentWindow.history.forward();
  });

  const newTabBtn = document.getElementById('newTabBtn');
  if (newTabBtn) newTabBtn.addEventListener('click', () => createNewTab());
  
  const tabSwitcherBtn = document.getElementById('tabSwitcherBtn');
  if (tabSwitcherBtn) tabSwitcherBtn.addEventListener('click', toggleTabSwitcher);
  
  const doneTabsBtn = document.getElementById('doneTabs');
  if (doneTabsBtn) doneTabsBtn.addEventListener('click', toggleTabSwitcher);
  
  const newTabSwitcherBtn = document.getElementById('newTabSwitcherBtn');
  if (newTabSwitcherBtn) newTabSwitcherBtn.addEventListener('click', () => {
    createNewTab();
    toggleTabSwitcher();
  });
  
  const closeAllTabsBtn = document.getElementById('closeAllTabs');
  if (closeAllTabsBtn) closeAllTabsBtn.addEventListener('click', closeAllTabs);


  // Download Manager Events
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const activeTab = tabs.find(t => t.id === activeTabId);
      const url = prompt("Enter URL to download:", activeTab ? activeTab.url : "");
      if (url) startDownload(url);
    });
  }
  const closeDownloadsBtn = document.getElementById('closeDownloads');
  if (closeDownloadsBtn) closeDownloadsBtn.addEventListener('click', toggleDownloads);
  
  const clearCompletedBtn = document.getElementById('clearCompletedBtn');
  if (clearCompletedBtn) clearCompletedBtn.addEventListener('click', clearCompletedDownloads);
}


function toggleDownloads() {
  if (downloadsOverlay) {
    downloadsOverlay.classList.toggle('active');
    if (downloadsOverlay.classList.contains('active')) {
      updateDownloadsUI();
    }
  }
}

async function startDownload(url) {
  const id = Date.now();
  const fileName = url.split('/').pop() || 'downloaded-file';
  
  const download = {
    id,
    name: fileName,
    url,
    progress: 0,
    status: 'downloading',
    totalSize: 0,
    downloadedSize: 0,
    blob: null,
    controller: new AbortController()
  };
  
  downloads.push(download);
  toggleDownloads();
  updateDownloadsUI();

  try {
    const response = await fetch(url, { signal: download.controller.signal });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const contentLength = response.headers.get('content-length');
    download.totalSize = parseInt(contentLength, 10) || 0;
    
    const reader = response.body.getReader();
    let receivedLength = 0;
    const chunks = [];
    
    let lastUpdate = 0;
    while(true) {
      const {done, value} = await reader.read();
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;
      
      download.downloadedSize = receivedLength;
      download.progress = download.totalSize ? (receivedLength / download.totalSize) * 100 : 0;
      
      // Throttle UI updates to ~10fps
      const now = Date.now();
      if (now - lastUpdate > 100) {
        updateDownloadsUI();
        lastUpdate = now;
      }
    }

    download.blob = new Blob(chunks);
    download.status = 'completed';
    download.progress = 100;
  } catch (err) {
    if (err.name === 'AbortError') {
      download.status = 'cancelled';
    } else {
      download.status = 'error';
      console.error('Download failed:', err);
    }
  }
  updateDownloadsUI();
}

function updateDownloadsUI() {
  if (!downloadsList) return;
  
  if (downloads.length === 0) {
    downloadsList.innerHTML = '<div class="no-downloads">No active downloads</div>';
    return;
  }

  downloadsList.innerHTML = downloads.map(dl => `
    <div class="download-item">
      <div class="download-info">
        <div class="download-name">${dl.name}</div>
        <div class="download-meta">${dl.status === 'completed' ? 'Completed' : formatBytes(dl.downloadedSize) + ' of ' + formatBytes(dl.totalSize)}</div>
      </div>
      <div class="download-progress-container">
        <div class="download-progress-bar" style="width: ${dl.progress}%"></div>
      </div>
      <div class="download-actions">
        ${dl.status === 'downloading' ? `
          <button onclick="cancelDownload(${dl.id})" class="dl-action-btn"><i data-lucide="x-circle"></i></button>
        ` : dl.status === 'completed' ? `
          <button onclick="saveFile(${dl.id})" class="dl-action-btn"><i data-lucide="download"></i></button>
          <button onclick="removeDownload(${dl.id})" class="dl-action-btn"><i data-lucide="trash-2"></i></button>
        ` : `
          <button onclick="removeDownload(${dl.id})" class="dl-action-btn"><i data-lucide="trash-2"></i></button>
        `}
      </div>
    </div>
  `).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: downloadsList });
}


function clearCompletedDownloads() {
  downloads = downloads.filter(dl => dl.status !== 'completed');
  updateDownloadsUI();
}


function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

window.cancelDownload = (id) => {
  const dl = downloads.find(d => d.id === id);
  if (dl) dl.controller.abort();
};

window.removeDownload = (id) => {
  downloads = downloads.filter(d => d.id !== id);
  updateDownloadsUI();
};

window.saveFile = (id) => {
  const dl = downloads.find(d => d.id === id);
  if (dl && dl.blob) {
    const url = window.URL.createObjectURL(dl.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dl.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};

window.toggleDownloads = toggleDownloads;

function createNewTab(url = BROWSER_CONFIG.defaultHome) {
  const id = Date.now();
  const iframe = document.createElement('iframe');
  iframe.id = `iframe-${id}`;
  iframe.frameBorder = "0";
  iframe.style.display = 'none';
  
  // Handle loading state
  iframe.onload = () => {
    const loader = document.getElementById('browserLoader');
    if (loader) loader.classList.remove('active');
  };
  
  iframe.src = url === 'about:home' ? '' : url;
  
  if (tabsContainer) tabsContainer.appendChild(iframe);
  
  const newTab = { id, url, title: 'New Tab', iframe };
  tabs.push(newTab);
  
  switchTab(id);
  updateTabSwitcherUI();
}

function switchTab(id) {
  activeTabId = id;
  const activeTab = tabs.find(t => t.id === id);
  const isHome = !activeTab || activeTab.url === 'about:home' || activeTab.url === '';
  
  const browserHome = document.getElementById('browserHome');
  if (browserHome) browserHome.style.display = isHome ? 'flex' : 'none';
  
  tabs.forEach(tab => {
    tab.iframe.style.display = (tab.id === id && !isHome) ? 'block' : 'none';
    if (tab.id === id && browserInput) {
      browserInput.value = isHome ? '' : tab.url;
    }
  });
  updateTabSwitcherUI();
}

window.loadUrl = (url) => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    activeTab.url = url;
    activeTab.iframe.src = url;
    const loader = document.getElementById('browserLoader');
    if (loader) loader.classList.add('active');
    switchTab(activeTabId);
  }
};

window.openExternal = () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.url && activeTab.url !== 'about:home') {
    window.open(activeTab.url, '_blank');
  }
};

function cleanupIframe(iframe) {
  if (iframe) {
    iframe.src = 'about:blank'; // Free memory
    iframe.remove();
  }
}

function closeTab(id, e) {
  if (e) e.stopPropagation();
  const index = tabs.findIndex(t => t.id === id);
  if (index === -1) return;

  const tab = tabs[index];
  cleanupIframe(tab.iframe);
  tabs.splice(index, 1);

  if (tabs.length === 0) {
    createNewTab();
  } else if (activeTabId === id) {
    switchTab(tabs[Math.max(0, index - 1)].id);
  }
  
  updateTabSwitcherUI();
}

function closeAllTabs() {
  tabs.forEach(t => cleanupIframe(t.iframe));
  tabs = [];
  createNewTab();
  toggleTabSwitcher();
}

function toggleTabSwitcher() {
  if (tabSwitcher) {
    tabSwitcher.classList.toggle('active');
    if (tabSwitcher.classList.contains('active')) {
      updateTabSwitcherUI();
    }
  }
}

function updateTabSwitcherUI() {
  if (tabCountEl) tabCountEl.textContent = tabs.length;
  if (!tabGrid) return;

  tabGrid.innerHTML = tabs.map(tab => `
    <div class="tab-card ${tab.id === activeTabId ? 'active' : ''}" onclick="switchTab(${tab.id}); toggleTabSwitcher();">
      <div class="tab-card-header">
        <div class="tab-card-title">${tab.title || tab.url}</div>
        <button class="tab-close-btn" onclick="closeTab(${tab.id}, event)">
          <i data-lucide="x" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
      <div class="tab-card-preview">
        <i data-lucide="globe" style="width: 48px; height: 48px; opacity: 0.1;"></i>
      </div>
    </div>
  `).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: tabGrid });
}



// Make globally accessible for onclick handlers
window.switchTab = switchTab;
window.toggleTabSwitcher = toggleTabSwitcher;
window.closeTab = closeTab;



function renderLibrary(filteredSongs = songs) {
  const grid = document.getElementById('libraryGrid');
  if (grid) {
    grid.innerHTML = filteredSongs.map((song, index) => {
      // Find original index for playing
      const originalIndex = songs.indexOf(song);
      return `
        <div class="music-card" onclick="playSong(${originalIndex})">
          <img src="${song.artwork}" alt="${song.title}" class="card-image" loading="lazy">
          <div class="card-title">${song.title}</div>
          <div class="card-subtitle">${song.artist}</div>
        </div>
      `;
    }).join('');
  }
}

window.playSong = function(index) {
  if (index < 0 || index >= songs.length) return;
  
  currentSongIndex = index;
  const song = songs[index];
  
  stopAllEngines();

  activeEngine = (song.type === 'local' && song.fileType && song.fileType.startsWith('video')) ? 'local-video' : 'local-audio';

  updateSongUI(song);
  
  if (activeEngine === 'local-audio') {
    localAudio.src = song.source;
    localAudio.play().catch(console.error);
    isPlaying = true;
    startProgressTimer();
  } else if (activeEngine === 'local-video') {
    localVideo.src = song.source;
    localVideo.play().catch(console.error);
    isPlaying = true;
    setMode('video');
    startProgressTimer();
  }

  updateControlsUI();
  openDrawer();
};


function stopAllEngines() {
  if (localAudio) {
    localAudio.pause();
    localAudio.currentTime = 0;
  }
  if (localVideo) {
    localVideo.pause();
    localVideo.currentTime = 0;
  }
  isPlaying = false;
  stopProgressTimer();
}


function updateSongUI(song, initial = false) {
  if (!song) return;
  if (miniTitle) miniTitle.textContent = song.title;
  if (miniArtist) miniArtist.textContent = song.artist;
  if (miniArtwork) miniArtwork.src = song.artwork;
  
  if (fullTitle) fullTitle.textContent = song.title;
  if (fullArtist) fullArtist.textContent = song.artist;
  if (fullArtwork) fullArtwork.src = song.artwork;
  
  updateBackground(song.color || '#181818', initial);
  
  if (durationEl) durationEl.textContent = formatTime(song.duration || 0);
  renderLyrics(song);
  
  const toggleVideoBtn = document.getElementById('toggleVideo');
  if (toggleVideoBtn) {
    if (song.type === 'local' && song.fileType && song.fileType.startsWith('video')) {
      toggleVideoBtn.style.display = 'block';
    } else {
      toggleVideoBtn.style.display = 'none';
      setMode('audio');
    }
  }
}

function setMode(mode) {
  currentMode = mode;
  if (!videoContainer || !artworkContainer) return;

  if (mode === 'video') {
    videoContainer.classList.add('active');
    artworkContainer.classList.add('hidden');
    videoContainer.appendChild(localVideo);
    if (localVideo) localVideo.style.display = 'block';
  } else {
    videoContainer.classList.remove('active');
    artworkContainer.classList.remove('hidden');
    if (localVideo) localVideo.style.display = 'none';
  }
}


function updateBackground(color, initial) {
  if (!bgLayer1 || !bgLayer2) return;
  const targetLayer = activeBgLayer === 1 ? bgLayer2 : bgLayer1;
  const currentLayer = activeBgLayer === 1 ? bgLayer1 : bgLayer2;
  
  targetLayer.style.background = `radial-gradient(circle at top, ${color}, #121212)`;
  
  if (!initial) {
    targetLayer.classList.add('active');
    currentLayer.classList.remove('active');
    activeBgLayer = activeBgLayer === 1 ? 2 : 1;
  } else {
    bgLayer1.style.background = `radial-gradient(circle at top, ${color}, #121212)`;
    bgLayer1.classList.add('active');
  }
}

function startProgressTimer() {
  if (playbackInterval) clearInterval(playbackInterval);
  playbackInterval = setInterval(updateProgressUI, 500);
}

function stopProgressTimer() {
  clearInterval(playbackInterval);
}

function updateProgressUI() {
  let current = 0;
  let total = 0;

  if (activeEngine === 'local-audio' && localAudio) {
    current = localAudio.currentTime;
    total = localAudio.duration;
  } else if (activeEngine === 'local-video' && localVideo) {
    current = localVideo.currentTime;
    total = localVideo.duration;
  }

  if (total > 0) {
    const percent = (current / total) * 100;
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
    if (durationEl) durationEl.textContent = formatTime(total);
    syncLyrics(current);
  }
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function togglePlayback() {
  if (isPlaying) {
    if (activeEngine === 'local-audio') localAudio.pause();
    else if (activeEngine === 'local-video') localVideo.pause();
    isPlaying = false;
  } else {
    if (activeEngine === 'local-audio') localAudio.play().catch(console.error);
    else if (activeEngine === 'local-video') localVideo.play().catch(console.error);
    isPlaying = true;
    startProgressTimer();
  }
  updateControlsUI();
}


function updateControlsUI() {
  const iconName = isPlaying ? 'pause' : 'play';
  if (mainPlayIcon) mainPlayIcon.setAttribute('data-lucide', iconName);
  if (miniPlayIcon) miniPlayIcon.setAttribute('data-lucide', iconName);
  
  // Show/Hide mini player
  if (miniPlayer) {
    if (isPlaying || (activeEngine && ((localAudio && localAudio.src) || (localVideo && localVideo.src)))) {
      miniPlayer.style.display = 'flex';
      setTimeout(() => miniPlayer.style.opacity = '1', 10);
    } else {
      miniPlayer.style.opacity = '0';
      setTimeout(() => { if (!isPlaying) miniPlayer.style.display = 'none'; }, 300);
    }
  }

  if (typeof lucide !== 'undefined') {
    if (miniPlayer) lucide.createIcons({ root: miniPlayer });
    if (nowPlayingDrawer) lucide.createIcons({ root: nowPlayingDrawer });
  }
}



function nextSong() {
  currentSongIndex = (currentSongIndex + 1) % songs.length;
  playSong(currentSongIndex);
}

function prevSong() {
  currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
  playSong(currentSongIndex);
}

// Search
let searchTimeout = null;
if (localSearchInput) {
  localSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = songs.filter(s => 
      s.title.toLowerCase().includes(query) || 
      s.artist.toLowerCase().includes(query)
    );
    renderLibrary(filtered);
  });
}

function renderPlaylists() {
  const grid = document.getElementById('playlistGrid');
  if (!grid) return;
  grid.innerHTML = playlists.map(p => `
    <div class="music-card">
      <img src="${p.artwork}" alt="${p.name}" class="card-image" style="border-radius: 8px;" loading="lazy">
      <div class="card-title">${p.name}</div>
    </div>
  `).join('');
}


// UI Events
function setupEventListeners() {
  if (themeToggle) {
    themeToggle.addEventListener('change', () => {
      document.body.classList.toggle('light-theme', !themeToggle.checked);
      saveSettings();
    });
  }

  if (toolbarPositionSelect) {
    toolbarPositionSelect.addEventListener('change', (e) => {
      updateToolbarPosition(e.target.value);
      saveSettings();
    });
  }

  if (dnsSelect) dnsSelect.addEventListener('change', saveSettings);
  if (forceZoomToggle) forceZoomToggle.addEventListener('change', saveSettings);

  if (fileInput) {
    const importBtn = document.getElementById('importBtn');
    if (importBtn) importBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        localUrls.add(url);
        songs.push({
          id: Date.now(),
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: "Local File",
          artwork: "assets/art4.png", 
          type: 'local',
          source: url,
          fileType: file.type,
          color: '#181818'
        });
      });
      renderLibrary();
      // switch to library view automatically
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
      const musicNav = document.querySelector('.nav-item[data-tab="viewMusic"]');
      if (musicNav) musicNav.classList.add('active');
      const viewMusic = document.getElementById('viewMusic');
      if (viewMusic) viewMusic.classList.add('active');
    });
  }

  if (miniPlayer) {
    miniPlayer.addEventListener('click', (e) => {
      if (e.target.closest('.control-btn')) return;
      openDrawer();
    });
  }

  const closeDrawerBtn = document.getElementById('closeDrawer');
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
  
  const backBtnDrawer = document.getElementById('backBtnDrawer');
  if (backBtnDrawer) backBtnDrawer.addEventListener('click', closeDrawer);
  
  const mainPlayPause = document.getElementById('mainPlayPause');
  if (mainPlayPause) mainPlayPause.addEventListener('click', togglePlayback);
  
  const miniPlayPause = document.getElementById('miniPlayPause');
  if (miniPlayPause) {
    miniPlayPause.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayback();
    });
  }
  
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) nextBtn.addEventListener('click', nextSong);
  
  const prevBtn = document.getElementById('prevBtn');
  if (prevBtn) prevBtn.addEventListener('click', prevSong);
  
  const toggleVideo = document.getElementById('toggleVideo');
  if (toggleVideo) {
    toggleVideo.addEventListener('click', () => {
      setMode(currentMode === 'audio' ? 'video' : 'audio');
    });
  }

  const toggleLyricsBtn = document.getElementById('toggleLyrics');
  if (toggleLyricsBtn && lyricsContainer) {
    toggleLyricsBtn.addEventListener('click', () => {
      lyricsContainer.classList.toggle('active');
    });
  }

  const volumeSlider = document.getElementById('volumeSlider');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const vol = e.target.value;
      if (localAudio) localAudio.volume = vol / 100;
      if (localVideo) localVideo.volume = vol / 100;
    });
  }

  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      
      let total = 0;
      if (activeEngine === 'local-audio' && localAudio) {
        total = localAudio.duration;
        localAudio.currentTime = total * pos;
      } else if (activeEngine === 'local-video' && localVideo) {
        total = localVideo.duration;
        localVideo.currentTime = total * pos;
      }
      updateProgressUI();
    });
  }
}


function openDrawer() {
  if (nowPlayingDrawer) nowPlayingDrawer.classList.add('open');
}

function closeDrawer() {
  if (nowPlayingDrawer) nowPlayingDrawer.classList.remove('open');
}

function renderLyrics(song) {
  if (!lyricsContainer) return;
  if (!song || !song.lyrics) {
    lyricsContainer.innerHTML = '<div class="lyric-line">No lyrics available for this track</div>';
    return;
  }

  lyricsContainer.innerHTML = song.lyrics.map((l, i) => `
    <div class="lyric-line" id="lyric-${i}">${l.text}</div>
  `).join('');
}

function syncLyrics(time) {
  const song = songs[currentSongIndex];
  if (!song || !song.lyrics) return;
  
  song.lyrics.forEach((l, i) => {
    const el = document.getElementById(`lyric-${i}`);
    if (time >= l.time) {
      document.querySelectorAll('.lyric-line').forEach(line => line.classList.remove('active'));
      if (el) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
}

function setupSwipeGestures() {
  if (!nowPlayingDrawer) return;
  let touchStartY = 0;
  nowPlayingDrawer.addEventListener('touchstart', (e) => touchStartY = e.touches[0].clientY, { passive: true });
  nowPlayingDrawer.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientY - touchStartY;
    if (diff > 100) closeDrawer();
  });
}

window.addEventListener('unload', () => {
  localUrls.forEach(url => URL.revokeObjectURL(url));
  tabs.forEach(t => cleanupIframe(t.iframe));
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
