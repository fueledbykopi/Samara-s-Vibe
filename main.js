import { songs, playlists } from './data.js';

// State
let currentSongIndex = 0;
let isPlaying = false;
let currentTime = 0;
let playbackInterval = null;
let activeBgLayer = 1;

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

// Initialize
function init() {
  renderLibrary();
  renderPlaylists();
  renderBrowse();
  renderRadio();
  updateSongUI(songs[currentSongIndex], true);
  setupEventListeners();
  setupSwipeGestures();
  lucide.createIcons();
}

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

window.playSong = function(index) {
  currentSongIndex = index;
  const song = songs[index];
  updateSongUI(song);
  startPlayback();
  openDrawer();
};

function updateSongUI(song, initial = false) {
  miniTitle.textContent = song.title;
  miniArtist.textContent = song.artist;
  miniArtwork.src = song.artwork;
  
  fullTitle.textContent = song.title;
  fullArtist.textContent = song.artist;
  fullArtwork.src = song.artwork;
  
  updateBackground(song.color, initial);
  
  durationEl.textContent = formatTime(song.duration);
  renderLyrics(song);
  resetProgress();
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

function renderLyrics(song) {
  if (!song.lyrics) {
    lyricsContainer.innerHTML = '<div class="lyric-line">No lyrics available</div>';
    return;
  }
  lyricsContainer.innerHTML = song.lyrics.map((l, i) => `
    <div class="lyric-line" id="lyric-${i}">${l.text}</div>
  `).join('');
}

function syncLyrics() {
  const song = songs[currentSongIndex];
  if (!song.lyrics) return;
  
  song.lyrics.forEach((l, i) => {
    const el = document.getElementById(`lyric-${i}`);
    if (currentTime >= l.time) {
      document.querySelectorAll('.lyric-line').forEach(line => line.classList.remove('active'));
      el.classList.add('active');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function resetProgress() {
  currentTime = 0;
  updateProgressUI();
}

function updateProgressUI() {
  const song = songs[currentSongIndex];
  const percent = (currentTime / song.duration) * 100;
  progressFill.style.width = `${percent}%`;
  currentTimeEl.textContent = formatTime(currentTime);
  syncLyrics();
}

function startPlayback() {
  isPlaying = true;
  updateControlsUI();
  fullArtwork.classList.add('playing');
  
  if (playbackInterval) clearInterval(playbackInterval);
  playbackInterval = setInterval(() => {
    if (currentTime < songs[currentSongIndex].duration) {
      currentTime++;
      updateProgressUI();
    } else {
      nextSong();
    }
  }, 1000);
}

function pausePlayback() {
  isPlaying = false;
  updateControlsUI();
  fullArtwork.classList.remove('playing');
  if (playbackInterval) clearInterval(playbackInterval);
}

function togglePlayback() {
  if (isPlaying) pausePlayback();
  else startPlayback();
}

function updateControlsUI() {
  const iconName = isPlaying ? 'pause' : 'play';
  mainPlayIcon.setAttribute('data-lucide', iconName);
  miniPlayIcon.setAttribute('data-lucide', iconName);
  lucide.createIcons();
}

function nextSong() {
  currentSongIndex = (currentSongIndex + 1) % songs.length;
  updateSongUI(songs[currentSongIndex]);
  if (isPlaying) startPlayback();
}

function prevSong() {
  currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
  updateSongUI(songs[currentSongIndex]);
  if (isPlaying) startPlayback();
}

function openDrawer() {
  nowPlayingDrawer.classList.add('open');
}

function closeDrawer() {
  nowPlayingDrawer.classList.remove('open');
  lyricsContainer.classList.remove('active');
}

function setupSwipeGestures() {
  let touchStartY = 0;
  let touchEndY = 0;

  nowPlayingDrawer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  nowPlayingDrawer.addEventListener('touchmove', (e) => {
    touchEndY = e.touches[0].clientY;
    const diff = touchEndY - touchStartY;
    if (diff > 0 && nowPlayingDrawer.scrollTop <= 0) {
      nowPlayingDrawer.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });

  nowPlayingDrawer.addEventListener('touchend', () => {
    const diff = touchEndY - touchStartY;
    if (diff > 150 && nowPlayingDrawer.scrollTop <= 0) {
      closeDrawer();
    }
    nowPlayingDrawer.style.transform = '';
  });
}

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      
      const target = document.getElementById(tab);
      if (target) target.classList.add('active');
      item.classList.add('active');
      
      // Haptic feedback simulation
      if (window.navigator.vibrate) window.navigator.vibrate(10);
    });
  });

  // Mini player click to open drawer
  miniPlayer.addEventListener('click', (e) => {
    if (e.target.closest('.control-btn')) return;
    openDrawer();
  });

  // Drawer controls
  document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
  document.getElementById('mainPlayPause').addEventListener('click', togglePlayback);
  document.getElementById('miniPlayPause').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayback();
  });
  document.getElementById('nextBtn').addEventListener('click', nextSong);
  document.getElementById('prevBtn').addEventListener('click', prevSong);

  // Volume Slider
  document.getElementById('volumeSlider').addEventListener('input', (e) => {
    console.log('Volume:', e.target.value);
  });

  // Lyrics Toggle
  document.getElementById('toggleLyrics').addEventListener('click', () => {
    lyricsContainer.classList.toggle('active');
  });
}

init();
