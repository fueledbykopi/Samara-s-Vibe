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
  defaultHome: 'https://www.bing.com'
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

const themeToggle = document.getElementById('themeToggle');



function init() {
  try {
    // Dismiss welcome screen early if possible, or keep the timer
    // Logic moved to index.html for faster execution, but keep this as fallback
    const hideWelcome = () => {
      const welcome = document.getElementById('welcomeScreen');
      if (welcome) {
          welcome.style.opacity = '0';
          setTimeout(() => welcome.style.display = 'none', 800);
      }
    };

    renderLibrary();
    renderPlaylists();
    setupEventListeners();
    setupSwipeGestures();
    setupBrowser();
    updateSongUI(songs[currentSongIndex], true);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (error) {
    console.error("Initialization error:", error);
    // Fallback: make sure welcome screen is hidden even on error
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.classList.add('hidden');
  }
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
  document.getElementById('tabSwitcherBtn').addEventListener('click', toggleTabSwitcher);
  document.getElementById('doneTabs').addEventListener('click', toggleTabSwitcher);
  document.getElementById('newTabSwitcherBtn').addEventListener('click', () => {
    createNewTab();
    toggleTabSwitcher();
  });
  document.getElementById('closeAllTabs').addEventListener('click', closeAllTabs);


  // Download Manager Events
  document.getElementById('downloadBtn').addEventListener('click', () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const url = prompt("Enter URL to download:", activeTab ? activeTab.url : "");
    if (url) startDownload(url);
  });
  document.getElementById('closeDownloads').addEventListener('click', toggleDownloads);
  document.getElementById('clearCompletedBtn').addEventListener('click', clearCompletedDownloads);
}


function toggleDownloads() {
  downloadsOverlay.classList.toggle('active');
  if (downloadsOverlay.classList.contains('active')) {
    updateDownloadsUI();
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
  iframe.src = url;
  iframe.id = `iframe-${id}`;
  iframe.frameBorder = "0";
  iframe.style.display = 'none';
  
  tabsContainer.appendChild(iframe);
  
  const newTab = { id, url, title: 'New Tab', iframe };
  tabs.push(newTab);
  
  switchTab(id);
  updateTabSwitcherUI();
}

function switchTab(id) {
  activeTabId = id;
  const activeTab = tabs.find(t => t.id === id);
  const isHome = !activeTab || activeTab.url === BROWSER_CONFIG.defaultHome || activeTab.url === '';
  
  document.getElementById('browserHome').style.display = isHome ? 'flex' : 'none';
  
  tabs.forEach(tab => {
    tab.iframe.style.display = (tab.id === id && !isHome) ? 'block' : 'none';
    if (tab.id === id) {
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
    switchTab(activeTabId);
  }
};

function closeTab(id, e) {
  if (e) e.stopPropagation();
  const index = tabs.findIndex(t => t.id === id);
  if (index === -1) return;

  const tab = tabs[index];
  tab.iframe.remove();
  tabs.splice(index, 1);

  if (tabs.length === 0) {
    createNewTab();
  } else if (activeTabId === id) {
    switchTab(tabs[Math.max(0, index - 1)].id);
  }
  
  updateTabSwitcherUI();
}

function closeAllTabs() {
  tabs.forEach(t => t.iframe.remove());
  tabs = [];
  createNewTab();
  toggleTabSwitcher();
}

function toggleTabSwitcher() {
  tabSwitcher.classList.toggle('active');
  if (tabSwitcher.classList.contains('active')) {
    updateTabSwitcherUI();
  }
}

function updateTabSwitcherUI() {
  tabCountEl.textContent = tabs.length;
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
  localAudio.pause();
  localAudio.currentTime = 0;
  localVideo.pause();
  localVideo.currentTime = 0;
  isPlaying = false;
  stopProgressTimer();
}


function updateSongUI(song, initial = false) {
  if (!song) return;
  miniTitle.textContent = song.title;
  miniArtist.textContent = song.artist;
  miniArtwork.src = song.artwork;
  
  fullTitle.textContent = song.title;
  fullArtist.textContent = song.artist;
  fullArtwork.src = song.artwork;
  
  updateBackground(song.color || '#181818', initial);
  
  durationEl.textContent = formatTime(song.duration || 0);
  renderLyrics(song);
  
  if (song.type === 'local' && song.fileType && song.fileType.startsWith('video')) {
    document.getElementById('toggleVideo').style.display = 'block';
  } else {
    document.getElementById('toggleVideo').style.display = 'none';
    setMode('audio');
  }
}

function setMode(mode) {
  currentMode = mode;
  if (mode === 'video') {
    videoContainer.classList.add('active');
    artworkContainer.classList.add('hidden');
    videoContainer.appendChild(localVideo);
    localVideo.style.display = 'block';
  } else {
    videoContainer.classList.remove('active');
    artworkContainer.classList.remove('hidden');
    localVideo.style.display = 'none';
  }
}


function updateBackground(color, initial) {
  const targetLayer = activeBgLayer === 1 ? bgLayer2 : bgLayer1;
  const currentLayer = activeBgLayer === 1 ? bgLayer1 : bgLayer2;
  
  // Spotify uses darker backgrounds
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

  if (activeEngine === 'local-audio') {
    current = localAudio.currentTime;
    total = localAudio.duration;
  } else if (activeEngine === 'local-video') {
    current = localVideo.currentTime;
    total = localVideo.duration;
  }


  if (total > 0) {
    const percent = (current / total) * 100;
    progressFill.style.width = `${percent}%`;
    currentTimeEl.textContent = formatTime(current);
    durationEl.textContent = formatTime(total);
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
  mainPlayIcon.setAttribute('data-lucide', iconName);
  miniPlayIcon.setAttribute('data-lucide', iconName);
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ root: miniPlayer });
    lucide.createIcons({ root: nowPlayingDrawer });
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

// Spotify-styled Search
let searchTimeout = null;
localSearchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = songs.filter(s => 
    s.title.toLowerCase().includes(query) || 
    s.artist.toLowerCase().includes(query)
  );
  renderLibrary(filtered);
});

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
  document.getElementById('libraryMenuBtn').addEventListener('click', () => {
    document.getElementById('libraryOverlay').classList.add('active');
  });

  document.getElementById('closeLibrary').addEventListener('click', () => {
    document.getElementById('libraryOverlay').classList.remove('active');
  });

  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsOverlay').classList.add('active');
  });

  document.getElementById('closeSettings').addEventListener('click', () => {
    document.getElementById('settingsOverlay').classList.remove('active');
  });

  themeToggle.addEventListener('change', () => {
    document.body.classList.toggle('light-theme', !themeToggle.checked);
  });

  document.getElementById('importBtn').addEventListener('click', () => fileInput.click());
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
    document.getElementById('libraryOverlay').classList.add('active');
  });

  miniPlayer.addEventListener('click', (e) => {
    if (e.target.closest('.control-btn')) return;
    openDrawer();
  });

  document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
  document.getElementById('backBtnDrawer').addEventListener('click', closeDrawer);
  document.getElementById('mainPlayPause').addEventListener('click', togglePlayback);
  document.getElementById('miniPlayPause').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayback();
  });
  document.getElementById('nextBtn').addEventListener('click', nextSong);
  document.getElementById('prevBtn').addEventListener('click', prevSong);
  
  document.getElementById('toggleVideo').addEventListener('click', () => {
    setMode(currentMode === 'audio' ? 'video' : 'audio');
  });

  document.getElementById('toggleLyrics').addEventListener('click', () => {
    lyricsContainer.classList.toggle('active');
  });

  document.getElementById('volumeSlider').addEventListener('input', (e) => {
    const vol = e.target.value;
    localAudio.volume = vol / 100;
    localVideo.volume = vol / 100;
  });


  // Seeking logic
  const progressBar = document.getElementById('progressBar');
  progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    
    let total = 0;
    if (activeEngine === 'local-audio') {
      total = localAudio.duration;
      localAudio.currentTime = total * pos;
    } else if (activeEngine === 'local-video') {
      total = localVideo.duration;
      localVideo.currentTime = total * pos;
    }
    updateProgressUI();

  });
}


function openDrawer() {
  nowPlayingDrawer.classList.add('open');
}

function closeDrawer() {
  nowPlayingDrawer.classList.remove('open');
}

function renderLyrics(song) {
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
  let touchStartY = 0;
  nowPlayingDrawer.addEventListener('touchstart', (e) => touchStartY = e.touches[0].clientY, { passive: true });
  nowPlayingDrawer.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientY - touchStartY;
    if (diff > 100) closeDrawer();
  });
}

window.addEventListener('unload', () => {
  localUrls.forEach(url => URL.revokeObjectURL(url));
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

