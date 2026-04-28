import { songs as initialSongs, playlists } from './data.js';

// State
let songs = [...initialSongs];
let currentSongIndex = 0;
let isPlaying = false;
let playbackInterval = null;
let activeBgLayer = 1;
let ytPlayer = null;
let currentMode = 'audio'; // 'audio' or 'video'
let activeEngine = 'youtube'; // 'youtube', 'local-audio', 'local-video'

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

// Initialize
function init() {
  renderLibrary();
  renderPlaylists();
  renderBrowse();
  renderRadio();
  setupEventListeners();
  setupSwipeGestures();
  initYouTube();
  updateSongUI(songs[currentSongIndex], true);
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
    videoId: songs[currentSongIndex].source,
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
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  console.log("YT Player Ready");
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
  grid.innerHTML = songs.map((song, index) => `
    <div class="music-card" onclick="playSong(${index})">
      <img src="${song.artwork}" alt="${song.title}" class="card-image" loading="lazy">
      <div class="card-title">${song.title}</div>
      <div class="card-subtitle">${song.artist}</div>
    </div>
  `).join('');
}

function renderPlaylists() {
  const grid = document.getElementById('playlistGrid');
  grid.innerHTML = playlists.map(p => `
    <div class="music-card">
      <img src="${p.artwork}" alt="${p.name}" class="card-image" style="border-radius: 12px;" loading="lazy">
      <div class="card-title">${p.name}</div>
    </div>
  `).join('');
}

function renderBrowse() {
  const grid = document.getElementById('browseGrid');
  grid.innerHTML = songs.slice().reverse().map((song, index) => `
    <div class="music-card" onclick="playSong(${songs.length - 1 - index})">
      <img src="${song.artwork}" alt="${song.title}" class="card-image" loading="lazy">
      <div class="card-title">${song.title}</div>
      <div class="card-subtitle">${song.artist}</div>
    </div>
  `).join('');
}

function renderRadio() {
  const grid = document.getElementById('radioGrid');
  const stations = [
    { name: "Apple Music 1", art: "assets/art6.png" },
    { name: "Hits Radio", art: "assets/art3.png" },
    { name: "Chill Station", art: "assets/art5.png" },
    { name: "Indie Wave", art: "assets/art2.png" }
  ];
  grid.innerHTML = stations.map(s => `
    <div class="music-card">
      <img src="${s.art}" alt="${s.name}" class="card-image" style="border-radius: 50%;" loading="lazy">
      <div class="card-title" style="text-align: center;">${s.name}</div>
    </div>
  `).join('');
}

// Playback Logic
window.playSong = function(index) {
  currentSongIndex = index;
  const song = songs[index];
  
  // Stop all engines
  stopAllEngines();

  activeEngine = song.type === 'youtube' ? 'youtube' : 
                 (song.type === 'local' && song.fileType.startsWith('video') ? 'local-video' : 'local-audio');

  updateSongUI(song);
  
  if (activeEngine === 'youtube') {
    if (ytPlayer && ytPlayer.loadVideoById) {
      ytPlayer.loadVideoById(song.source);
      // YT starts playing automatically if loadVideoById is called
    }
  } else if (activeEngine === 'local-audio') {
    localAudio.src = song.source;
    localAudio.play();
    isPlaying = true;
  } else if (activeEngine === 'local-video') {
    localVideo.src = song.source;
    localVideo.play();
    isPlaying = true;
    setMode('video');
  }

  updateControlsUI();
  openDrawer();
};

function stopAllEngines() {
  if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
  localAudio.pause();
  localAudio.currentTime = 0;
  localVideo.pause();
  localVideo.currentTime = 0;
  isPlaying = false;
  stopProgressTimer();
}

function updateSongUI(song, initial = false) {
  miniTitle.textContent = song.title;
  miniArtist.textContent = song.artist;
  miniArtwork.src = song.artwork;
  
  fullTitle.textContent = song.title;
  fullArtist.textContent = song.artist;
  fullArtwork.src = song.artwork;
  
  updateBackground(song.color || '#333', initial);
  
  durationEl.textContent = formatTime(song.duration || 0);
  renderLyrics(song);
  
  // If it's a video type but we are in audio mode, show artwork. 
  // If we want to force video mode for videos:
  if (song.type === 'youtube' || (song.type === 'local' && song.fileType.startsWith('video'))) {
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
    // If YouTube, we need to move the iframe to the drawer's video container
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
    // Move YT player back to hidden
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

  if (activeEngine === 'youtube' && ytPlayer && ytPlayer.getCurrentTime) {
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
  if (isNaN(seconds)) return "0:00";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function togglePlayback() {
  if (isPlaying) {
    if (activeEngine === 'youtube') ytPlayer.pauseVideo();
    else if (activeEngine === 'local-audio') localAudio.pause();
    else if (activeEngine === 'local-video') localVideo.pause();
    isPlaying = false;
  } else {
    if (activeEngine === 'youtube') ytPlayer.playVideo();
    else if (activeEngine === 'local-audio') localAudio.play();
    else if (activeEngine === 'local-video') localVideo.play();
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
  const query = e.target.value;
  if (query.length < 3) {
    searchResults.innerHTML = '';
    return;
  }
  searchTimeout = setTimeout(() => performSearch(query), 500);
});

async function performSearch(query) {
  // Since we don't have a full YouTube Data API key here, 
  // we can use a public search suggestion API to show "some" results
  // Or for this demo, I'll simulate fetching from YouTube
  searchResults.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Searching YouTube...</div>';
  
  try {
    // Note: In a real app, you'd use a backend to fetch actual YT search results.
    // Here I will use a mocked set of results for the demo that looks real.
    const mockResults = [
      { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi', thumb: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/default.jpg' },
      { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', thumb: 'https://i.ytimg.com/vi/JGwWNGJdvx8/default.jpg' },
      { id: 'f_E_6B66SAY', title: 'Ghost', artist: 'Justin Bieber', thumb: 'https://i.ytimg.com/vi/f_E_6B66SAY/default.jpg' },
      { id: '7_uG-sW3f68', title: 'Mendung Tanpo Udan', artist: 'Ndarboy Genk', thumb: 'https://i.ytimg.com/vi/7_uG-sW3f68/default.jpg' }
    ].filter(item => item.title.toLowerCase().includes(query.toLowerCase()) || item.artist.toLowerCase().includes(query.toLowerCase()));

    if (mockResults.length === 0) {
      searchResults.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No results found</div>';
      return;
    }

    searchResults.innerHTML = mockResults.map(item => `
      <div class="search-result-item" onclick="addAndPlay('${item.id}', '${item.title}', '${item.artist}', '${item.thumb}')">
        <img src="${item.thumb}" class="search-result-thumb">
        <div class="search-result-info">
          <div class="search-result-title">${item.title}</div>
          <div class="search-result-artist">${item.artist} • YouTube</div>
        </div>
        <i data-lucide="play-circle" style="opacity: 0.5;"></i>
      </div>
    `).join('');
    lucide.createIcons();
  } catch (err) {
    searchResults.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Error searching</div>';
  }
}

window.addAndPlay = function(id, title, artist, artwork) {
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

// Local File Import
document.getElementById('importBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    const newSong = {
      id: Date.now(),
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Local File",
      artwork: "assets/art4.png", // Default for local
      type: 'local',
      source: url,
      fileType: file.type,
      color: '#444'
    };
    songs.push(newSong);
  });
  renderLibrary();
});

// Other UI Events
function setupEventListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.getElementById(tab).classList.add('active');
      item.classList.add('active');
    });
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
    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(vol);
    localAudio.volume = vol / 100;
    localVideo.volume = vol / 100;
  });
}

function openDrawer() {
  nowPlayingDrawer.classList.add('open');
}

function closeDrawer() {
  nowPlayingDrawer.classList.remove('open');
}

function renderLyrics(song) {
  if (!song.lyrics) {
    lyricsContainer.innerHTML = '<div class="lyric-line">No lyrics available</div>';
    return;
  }
  lyricsContainer.innerHTML = song.lyrics.map((l, i) => `
    <div class="lyric-line" id="lyric-${i}">${l.text}</div>
  `).join('');
}

function syncLyrics(time) {
  const song = songs[currentSongIndex];
  if (!song.lyrics) return;
  
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

init();
