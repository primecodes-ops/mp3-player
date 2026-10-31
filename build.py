from pathlib import Path
import json

# Initialize all supported file formats
FILE_FORMATS = [".mp3", ".m4a", ".wav", ".mp4"]
audio_files = []

# get the path (json) for each file
for extension in FILE_FORMATS:
    audio_files.extend(Path("audio").glob(f"*{extension}"))

# sort alphabetically
audio_files = sorted(audio_files)

# initialize tracks
tracks = []

# append the paths in audio files in tracks.json
for path in audio_files:
    track = {"title": path.stem, "file": str(path)}
    tracks.append(track)

with open("tracks.json", "w") as file:
    json.dump(tracks, file, indent=2)

print(f"Successfully generated catalog with {len(tracks)} tracks.")
