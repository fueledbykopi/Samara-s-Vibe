import { songs as initialSongs, playlists } from './data.js';

// State
let songs = [...initialSongs];
let currentSongIndex = 0;
let isPlaying = false;
let playbackInterval = null;
let activeBgLayer = 1;
let ytPlayer = null;
let isYTReady = false;
let currentMode = 'audio';
let activeEngine = 'youtube';
let localUrls = new Set(); 

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
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const trendingGrid = document.getElementById('trendingGrid');
const themeToggle = document.getElementById('themeToggle');

// Initialize
function init() {
  renderLibrary();
  renderPlaylists();
  setupEventListeners();
  setupSwipeGestures();
  initYouTube();
  updateSongUI(songs[currentSongIndex], true);
  fetchTrending();
  // autoScanLocalFiles(); // Disabled by default to avoid permission popups immediately
  lucide.createIcons();
}

// YouTube API
function initYouTube() {
  if (window.YT && window.YT.Player) {
    onYouTubeIframeAPIReady();
  } else {
    window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
  }
}

function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    videoId: songs[currentSongIndex]?.source || '',
    playerVars: {
      'playsinline': 1,
      'controls': 0,
      'disablekb': 1,
      'fs': 0,
      'modestbranding': 1,
      'rel': 0
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
    }
  });
}

function onPlayerReady(event) {
  isYTReady = true;
  console.log("YT Player Ready");
}

function onPlayerError(event) {
  console.error("YT Player Error:", event.data);
  nextSong();
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    nextSong();
  } else if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    updateControlsUI();
    startProgressTimer();
  } else if (event.data === YT.PlayerState.PAUSED) {
    isPlaying = false;
    updateControlsUI();
    stopProgressTimer();
  }
}

// Rendering
function renderLibrary() {
  const grid = document.getElementById('libraryGrid');
  if (grid) {
    grid.innerHTML = songs.map((song, index) => `
      <div class="music-card" onclick="playSong(${index})">
        <img src="${song.artwork}" alt="${song.title}" class="card-image" loading="lazy">
        <div class="card-title">${song.title}</div>
        <div class="card-subtitle">${song.artist}</div>
      </div>
    `).join('');
  }
}

async function fetchTrending() {
  if (!trendingGrid) return;
  
  try {
    // Try multiple instances if one fails
    const instances = [
        'https://api.piped.victr.me',
        'https://piped-api.lunar.icu',
        'https://pipedapi.kavin.rocks'
    ];
    
    let data = null;
    for (const instance of instances) {
        try {
            const response = await fetch(`${instance}/trending?region=ID`);
            if (response.ok) {
                data = await response.json();
                break;
            }
        } catch (e) { continue; }
    }

    if (!data || data.length === 0) {
      trendingGrid.innerHTML = '<div style="grid-column: span 2; text-align: center; opacity: 0.5; padding: 20px;">Could not load trending music. Please try again.</div>';
      return;
    }

    trendingGrid.innerHTML = data.slice(0, 10).map(item => {
      const id = item.url.includes('v=') ? item.url.split('v=')[1] : item.url.split('/').pop();
      const thumb = item.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return `
        <div class="music-card" onclick="addAndPlay('${id}', '${item.title.replace(/'/g, "\\'")}', '${item.uploaderName.replace(/'/g, "\\'")}', '${thumb}')">
          <img src="${thumb}" alt="${item.title}" class="card-image" loading="lazy">
          <div class="card-title">${item.title}</div>
          <div class="card-subtitle">${item.uploaderName} • Trending</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    trendingGrid.innerHTML = '<div style="grid-column: span 2; text-align: center; opacity: 0.5; padding: 20px;">Error loading trending content.</div>';
  }
}

function renderPlaylists() {
  const grid = document.getElementById('playlistGrid');
  if (!grid) return;
  grid.innerHTML = playlists.map(p => `
    <div class="music-card">
      <img src="${p.artwork}" alt="${p.name}" class="card-image" style="border-radius: 12px;" loading="lazy">
      <div class="card-title">${p.name}</div>
    </div>
  `).join('');
}

// Playback Logic
window.playSong = function(index) {
  if (index < 0 || index >= songs.length) return;
  
  currentSongIndex = index;
  const song = songs[index];
  
  stopAllEngines();

  activeEngine = song.type === 'youtube' ? 'youtube' : 
                 (song.type === 'local' && song.fileType && song.fileType.startsWith('video') ? 'local-video' : 'local-audio');

  updateSongUI(song);
  
  if (activeEngine === 'youtube') {
    if (isYTReady && ytPlayer && ytPlayer.loadVideoById) {
      ytPlayer.loadVideoById(song.source);
    } else {
      setTimeout(() => playSong(index), 1000);
      return;
    }
  } else if (activeEngine === 'local-audio') {
    localAudio.src = song.source;
    localAudio.play().catch(console.error);
    isPlaying = true;
  } else if (activeEngine === 'local-video') {
    localVideo.src = song.source;
    localVideo.play().catch(console.error);
    isPlaying = true;
    setMode('video');
  }

  updateControlsUI();
  openDrawer();
};

function stopAllEngines() {
  if (ytPlayer && ytPlayer.stopVideo && isYTReady) ytPlayer.stopVideo();
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
  
  updateBackground(song.color || '#333', initial);
  
  durationEl.textContent = formatTime(song.duration || 0);
  renderLyrics(song);
  
  if (song.type === 'youtube' || (song.type === 'local' && song.fileType && song.fileType.startsWith('video'))) {
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
    if (activeEngine === 'youtube') {
      videoContainer.appendChild(document.getElementById('ytPlayerContainer'));
      document.getElementById('ytPlayerContainer').style.position = 'relative';
      document.getElementById('ytPlayerContainer').style.top = '0';
      document.getElementById('ytPlayerContainer').style.left = '0';
      document.getElementById('ytPlayerContainer').style.pointerEvents = 'auto';
    } else if (activeEngine === 'local-video') {
      videoContainer.appendChild(localVideo);
      localVideo.style.display = 'block';
    }
  } else {
    videoContainer.classList.remove('active');
    artworkContainer.classList.remove('hidden');
    document.body.appendChild(document.getElementById('ytPlayerContainer'));
    document.getElementById('ytPlayerContainer').style.position = 'absolute';
    document.getElementById('ytPlayerContainer').style.top = '-9999px';
    document.getElementById('ytPlayerContainer').style.pointerEvents = 'none';
    localVideo.style.display = 'none';
  }
}

function updateBackground(color, initial) {
  const targetLayer = activeBgLayer === 1 ? bgLayer2 : bgLayer1;
  const currentLayer = activeBgLayer === 1 ? bgLayer1 : bgLayer2;
  
  targetLayer.style.background = `radial-gradient(circle at top, ${color}, #000)`;
  
  if (!initial) {
    targetLayer.classList.add('active');
    currentLayer.classList.remove('active');
    activeBgLayer = activeBgLayer === 1 ? 2 : 1;
  } else {
    bgLayer1.style.background = `radial-gradient(circle at top, ${color}, #000)`;
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

  if (activeEngine === 'youtube' && isYTReady && ytPlayer && ytPlayer.getCurrentTime) {
    current = ytPlayer.getCurrentTime();
    total = ytPlayer.getDuration();
  } else if (activeEngine === 'local-audio') {
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
    if (activeEngine === 'youtube' && isYTReady) ytPlayer.pauseVideo();
    else if (activeEngine === 'local-audio') localAudio.pause();
    else if (activeEngine === 'local-video') localVideo.pause();
    isPlaying = false;
  } else {
    if (activeEngine === 'youtube' && isYTReady) ytPlayer.playVideo();
    else if (activeEngine === 'local-audio') localAudio.play().catch(console.error);
    else if (activeEngine === 'local-video') localVideo.play().catch(console.error);
    isPlaying = true;
  }
  updateControlsUI();
}

function updateControlsUI() {
  const iconName = isPlaying ? 'pause' : 'play';
  mainPlayIcon.setAttribute('data-lucide', iconName);
  miniPlayIcon.setAttribute('data-lucide', iconName);
  lucide.createIcons();
  
  if (isPlaying) fullArtwork.classList.add('playing');
  else fullArtwork.classList.remove('playing');
}

function nextSong() {
  currentSongIndex = (currentSongIndex + 1) % songs.length;
  playSong(currentSongIndex);
}

function prevSong() {
  currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
  playSong(currentSongIndex);
}

// Search Functionality
let searchTimeout = null;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  if (query.length < 2) {
    searchResults.innerHTML = '';
    return;
  }
  searchTimeout = setTimeout(() => performSearch(query), 500);
});

async function performSearch(query) {
  searchResults.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Searching YouTube...</div>';
  
  try {
    const instances = [
        'https://api.piped.victr.me',
        'https://piped-api.lunar.icu',
        'https://pipedapi.kavin.rocks'
    ];
    
    let data = null;
    for (const instance of instances) {
        try {
            const response = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=videos`);
            if (response.ok) {
                data = await response.json();
                break;
            }
        } catch (e) { continue; }
    }
    
    if (!data || !data.items || data.items.length === 0) {
      searchResults.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No results found.</div>';
      return;
    }

    const results = data.items.slice(0, 10);

    searchResults.innerHTML = results.map(item => {
      const id = item.url.includes('v=') ? item.url.split('v=')[1] : item.url.split('/').pop();
      const thumb = item.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      
      return `
        <div class="search-result-item" onclick="addAndPlay('${id}', '${item.title.replace(/'/g, "\\'")}', '${item.uploaderName.replace(/'/g, "\\'")}', '${thumb}')">
          <img src="${thumb}" class="search-result-thumb">
          <div class="search-result-info">
            <div class="search-result-title">${item.title}</div>
            <div class="search-result-artist">${item.uploaderName} • YouTube</div>
          </div>
          <i data-lucide="play-circle" style="opacity: 0.5;"></i>
        </div>
      `;
    }).join('');
    lucide.createIcons();
  } catch (err) {
    searchResults.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Connection failed.</div>';
  }
}

window.addAndPlay = function(id, title, artist, artwork) {
  const existingIndex = songs.findIndex(s => s.source === id);
  if (existingIndex !== -1) {
    playSong(existingIndex);
    return;
  }

  const newSong = {
    id: Date.now(),
    title,
    artist,
    artwork,
    type: 'youtube',
    source: id,
    color: '#333'
  };
  songs.push(newSong);
  renderLibrary();
  playSong(songs.length - 1);
};

// UI Events
function setupEventListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      const target = document.getElementById(tab);
      if (target) target.classList.add('active');
      item.classList.add('active');
    });
  });

  themeToggle.addEventListener('change', () => {
    document.body.classList.toggle('light-theme', !themeToggle.checked);
    localStorage.setItem('samara-vibe-theme', themeToggle.checked ? 'dark' : 'light');
  });

  const savedTheme = localStorage.getItem('samara-vibe-theme');
  if (savedTheme === 'light') {
    themeToggle.checked = false;
    document.body.classList.add('light-theme');
  }

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
        color: '#444'
      });
    });
    renderLibrary();
    // switch to library to show results
    document.querySelector('[data-tab="library"]').click();
  });

  miniPlayer.addEventListener('click', (e) => {
    if (e.target.closest('.control-btn')) return;
    openDrawer();
  });

  document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
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
    if (ytPlayer && isYTReady && ytPlayer.setVolume) ytPlayer.setVolume(vol);
    localAudio.volume = vol / 100;
    localVideo.volume = vol / 100;
  });

  setTimeout(() => {
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.classList.add('hidden');
  }, 2500);
}

function openDrawer() {
  nowPlayingDrawer.classList.add('open');
}

function closeDrawer() {
  nowPlayingDrawer.classList.remove('open');
}

function renderLyrics(song) {
  if (!song || !song.lyrics) {
    lyricsContainer.innerHTML = '<div class="lyric-line">No lyrics available</div>';
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

init();
