
const tracklist = document.querySelector("#tracklist");
const player = document.querySelector("#player");
const playbackSelector = document.querySelector("#playbackMode");

let tracks = [];
let currentTrackIndex = -1;

// Default playback mode
let playbackMode = "next";


// 1. Fetch music catalog
async function loadTracks() {
    try {
        const response = await fetch("tracks.json");

        // Check if the request was successful
        if (!response.ok) {
            throw new Error(`Failed to load tracks.json: ${response.status}`);
        }

        tracks = await response.json();

        // Display available tracks
        displayTracks();

    } catch (error) {
        console.error("Error loading music catalog:", error);
        tracklist.textContent = "Unable to load music tracks.";
    }
}


// 2. Display available tracks
function displayTracks() {
    tracklist.innerHTML = "";

    tracks.forEach((track, index) => {
        const li = document.createElement("li");

        li.textContent = track.title;

        li.addEventListener("click", () => {
            playTrack(index);
        });

        tracklist.appendChild(li);
    });
}


// 3. Play selected track
function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;

    // Remove playing class from previous track
    for (const li of tracklist.children) {
        li.classList.remove("playing");
    }

    // Update current track index
    currentTrackIndex = index;

    // Highlight the currently selected track
    tracklist.children[index].classList.add("playing");

    // Set audio source
    player.src = tracks[index].file;

    // Start playback and handle errors
    player.play().catch(error => {
        console.error("Error playing track:", error);
    });
}


// 4. Update playback mode
playbackSelector.addEventListener("change", () => {
    playbackMode = playbackSelector.value;
});


// 5. Handle track completion
player.addEventListener("ended", () => {

    if (playbackMode === "repeat") {
        // Replay current track
        playTrack(currentTrackIndex);
    }

    else if (playbackMode === "next") {
        // Move to next track
        const nextTrackIndex = currentTrackIndex + 1;

        if (nextTrackIndex < tracks.length) {
            playTrack(nextTrackIndex);
        }
    }

});


// 6. Initialize music player
loadTracks();
