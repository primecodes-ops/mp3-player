// =====================================================
// Guitar Covers player
// Works with the new index.html (custom player bar) + style.css
// =====================================================

// ---------- Elements ----------
const tracklist = document.querySelector("#tracklist");
const player = document.querySelector("#player");

const nowTitle = document.querySelector("#nowTitle");
const nowThumb = document.querySelector(".now-playing .thumb");

const shuffleBtn = document.querySelector("#shuffleBtn");
const prevBtn = document.querySelector("#prevBtn");
const playBtn = document.querySelector("#playBtn");
const nextBtn = document.querySelector("#nextBtn");
const repeatBtn = document.querySelector("#repeatBtn");

const seek = document.querySelector("#seek");
const currentTimeEl = document.querySelector("#currentTime");
const durationEl = document.querySelector("#duration");
const volume = document.querySelector("#volume");


// ---------- State ----------
let tracks = [];
let currentIndex = -1;      // which track (index into tracks) is loaded

let shuffle = false;
let repeatMode = "off";     // "off" | "all" | "one"

let queue = [];             // play order: a list of track indexes
let queuePos = -1;          // where we are inside the queue

let isSeeking = false;      // true while the user drags the seek bar


// ---------- Small helpers ----------

// Safely add an event listener (does nothing if the element is missing)
function on(element, eventName, handler) {
    if (element) element.addEventListener(eventName, handler);
}

// 125 -> "2:05"
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
}

// Fills the left part of a range slider (the CSS reads --progress)
function setFill(slider, value, max) {
    if (!slider) return;
    const percent = max > 0 ? (value / max) * 100 : 0;
    slider.style.setProperty("--progress", `${percent}%`);
}

// Encode each part of the path so spaces, #, ? etc. don't break the URL
function encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
}

function firstLetter(text) {
    return (text || "?").trim().charAt(0).toUpperCase() || "?";
}


// ---------- 1. Load the catalog ----------
async function loadTracks() {
    try {
        const response = await fetch("tracks.json");

        if (!response.ok) {
            throw new Error(`Failed to load tracks.json: ${response.status}`);
        }

        tracks = await response.json();
        displayTracks();
        buildQueue(-1);

    } catch (error) {
        console.error("Error loading music catalog:", error);
        tracklist.textContent = "Unable to load music tracks.";
    }
}


// ---------- 2. Build the track rows ----------
// Each row: <li> [ .thumb ] [ .track-info > .track-title ]
function displayTracks() {
    tracklist.innerHTML = "";

    tracks.forEach((track, index) => {
        const li = document.createElement("li");

        const thumb = document.createElement("div");
        thumb.className = "thumb";
        thumb.textContent = firstLetter(track.title);

        const info = document.createElement("div");
        info.className = "track-info";

        const title = document.createElement("div");
        title.className = "track-title";
        title.textContent = track.title;

        info.appendChild(title);
        li.appendChild(thumb);
        li.appendChild(info);

        // Clicking a row starts a fresh queue from that track
        li.addEventListener("click", () => selectTrack(index));

        tracklist.appendChild(li);
    });
}


// ---------- 3. Queue (handles shuffle) ----------
// The queue is just the order tracks will play in.
// Normal mode: 0, 1, 2, ...   Shuffle mode: random order, current track first.
function buildQueue(startIndex) {
    queue = tracks.map((_, i) => i);

    if (shuffle) {
        // Fisher-Yates shuffle
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }

        // Keep the current track at the front so it doesn't jump around
        if (startIndex >= 0) {
            queue = queue.filter(i => i !== startIndex);
            queue.unshift(startIndex);
        }
    }

    queuePos = startIndex >= 0 ? queue.indexOf(startIndex) : -1;
}


// ---------- 4. Playing tracks ----------

// User picked a track: rebuild the queue around it, then play it
function selectTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    buildQueue(index);
    loadAndPlay(index);
}

// Load a track into the audio element and start it
function loadAndPlay(index) {
    const track = tracks[index];
    if (!track) return;

    currentIndex = index;

    highlightTrack(index);
    updateNowPlaying(track);

    player.src = encodePath(track.file);
    player.play().catch(error => {
        // AbortError just means the user skipped before it started; ignore it
        if (error.name !== "AbortError") {
            console.error("Error playing track:", error);
        }
    });
}

function highlightTrack(index) {
    for (let i = 0; i < tracklist.children.length; i++) {
        tracklist.children[i].classList.toggle("playing", i === index);
    }
}

function updateNowPlaying(track) {
    if (nowTitle) nowTitle.textContent = track.title;
    if (nowThumb) nowThumb.textContent = firstLetter(track.title);
    document.title = `${track.title} · Guitar Covers`;

    // Reset the progress UI for the new track
    if (seek) {
        seek.value = 0;
        setFill(seek, 0, 1);
    }
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    if (durationEl) durationEl.textContent = "0:00";

    // Lock-screen / headphone-button info on phones
    if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            album: "Guitar Covers"
        });
    }
}

// auto = true when the track ended by itself, false when the user pressed Next
function nextTrack(auto = false) {
    if (tracks.length === 0) return;

    let pos = queuePos + 1;

    if (pos >= queue.length) {
        // Reached the end of the queue
        if (auto && repeatMode === "off") {
            stopPlayback();
            return;
        }
        // Repeat-all (or manual Next): start a new round
        // (reshuffled if shuffle is on)
        buildQueue(-1);
        pos = 0;
    }

    queuePos = pos;
    loadAndPlay(queue[pos]);
}

function prevTrack() {
    if (currentIndex === -1) return;

    // Like Spotify: if the song is past 3s, Previous restarts it
    if (player.currentTime > 3 || queuePos <= 0) {
        player.currentTime = 0;
        return;
    }

    queuePos--;
    loadAndPlay(queue[queuePos]);
}

function stopPlayback() {
    player.pause();
    player.currentTime = 0;
    updatePlayButton();
}

function togglePlay() {
    if (tracks.length === 0) return;

    // Nothing loaded yet: start from the first (or a random one in shuffle)
    if (currentIndex === -1) {
        const start = shuffle ? Math.floor(Math.random() * tracks.length) : 0;
        selectTrack(start);
        return;
    }

    if (player.paused || player.ended) {
        player.play().catch(error => console.error("Error playing track:", error));
    } else {
        player.pause();
    }
}


// ---------- 5. Button states ----------
function updatePlayButton() {
    if (!playBtn) return;
    const isPlaying = !player.paused && !player.ended;
    playBtn.textContent = isPlaying ? "⏸" : "▶";
    playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
}

function updateShuffleButton() {
    if (!shuffleBtn) return;
    shuffleBtn.classList.toggle("active", shuffle);
    shuffleBtn.setAttribute("aria-pressed", String(shuffle));
}

function updateRepeatButton() {
    if (!repeatBtn) return;
    repeatBtn.classList.toggle("active", repeatMode !== "off");
    repeatBtn.textContent = repeatMode === "one" ? "↻1" : "↻";
    repeatBtn.setAttribute("aria-label", `Repeat: ${repeatMode}`);
}


// ---------- 6. Wire up the controls ----------
on(playBtn, "click", togglePlay);
on(nextBtn, "click", () => nextTrack(false));
on(prevBtn, "click", prevTrack);

on(shuffleBtn, "click", () => {
    shuffle = !shuffle;
    buildQueue(currentIndex);   // rebuild the order around what's playing now
    updateShuffleButton();
});

on(repeatBtn, "click", () => {
    // off -> all -> one -> off
    repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
    updateRepeatButton();
});

// Seek bar: while dragging only update the display, commit on release
on(seek, "input", () => {
    isSeeking = true;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(Number(seek.value));
    setFill(seek, Number(seek.value), Number(seek.max));
});

on(seek, "change", () => {
    player.currentTime = Number(seek.value);
    isSeeking = false;
});

// Volume
on(volume, "input", () => {
    player.volume = Number(volume.value);
    setFill(volume, Number(volume.value), 1);
});


// ---------- 7. Listen to the audio element ----------
on(player, "play", updatePlayButton);
on(player, "pause", updatePlayButton);

on(player, "loadedmetadata", () => {
    if (seek) {
        seek.step = "any";
        seek.max = player.duration;
    }
    if (durationEl) durationEl.textContent = formatTime(player.duration);
});

on(player, "timeupdate", () => {
    if (isSeeking) return;
    if (seek) {
        seek.value = player.currentTime;
        setFill(seek, player.currentTime, player.duration);
    }
    if (currentTimeEl) currentTimeEl.textContent = formatTime(player.currentTime);
});

on(player, "ended", () => {
    if (repeatMode === "one") {
        player.currentTime = 0;
        player.play().catch(error => console.error("Error replaying track:", error));
    } else {
        nextTrack(true);
    }
    updatePlayButton();
});

on(player, "error", () => {
    console.error("Audio failed to load:", player.src);
    if (nowTitle) nowTitle.textContent = "Couldn't load this track";
    updatePlayButton();
});

// Headphone buttons / lock screen controls
if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => player.play());
    navigator.mediaSession.setActionHandler("pause", () => player.pause());
    navigator.mediaSession.setActionHandler("previoustrack", prevTrack);
    navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack(false));
}


// ---------- 8. Start ----------
if (volume) {
    player.volume = Number(volume.value);
    setFill(volume, Number(volume.value), 1);
}
updatePlayButton();
updateShuffleButton();
updateRepeatButton();
loadTracks();