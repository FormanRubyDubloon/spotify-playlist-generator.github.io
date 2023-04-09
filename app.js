const clientId = '5a5cb54595bf495f805181938026b529';
const redirectUri = 'https://FormanRubyDubloon.github.io/spotify-playlist-generator.github.io/';
const scopes = 'playlist-modify-public';

function onAuthenticateButtonClick() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location.href = authUrl;
}

document.getElementById('authenticate').addEventListener('click', onAuthenticateButtonClick);

async function fetchGptSuggestions(prompt) {
  const response = await fetch('https://4bru83i736.execute-api.us-east-1.amazonaws.com/prod/gpt-suggestions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  const data = await response.json();
  return data;
}

function extractTrackListFromGptSuggestion(suggestion) {
  const lines = suggestion.split('\n');
  const trackList = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) continue;

    const match = trimmedLine.match(/^(.+?) - (.+)$/);
    if (match) {
      const artist = match[1].trim();
      const title = match[2].trim();
      trackList.push({ artist, title });
    }
  }

  return trackList;
}


async function searchTrack(accessToken, artist, title) {
  const query = encodeURIComponent(`artist:${artist} track:${title}`);
  const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  const data = await response.json();
  if (data.tracks.items.length > 0) {
    return data.tracks.items[0].id;
  }
  return null;
}

async function createPlaylist(accessToken, userId, tracks) {
  const apiBaseUrl = 'https://api.spotify.com/v1';
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const playlistResponse = await fetch(`${apiBaseUrl}/users/${userId}/playlists`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ name: 'Generated Playlist', public: true }),
  });

  const playlist = await playlistResponse.json();
  const uris = tracks.map(trackId => `spotify:track:${trackId}`);

  await fetch(`${apiBaseUrl}/playlists/${playlist.id}/tracks`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ uris }),
  });

  return playlist.external_urls.spotify;
}

async function createTextPlaylist(accessToken, trackList, trackIds) {
  const playlistElement = document.getElementById('textPlaylist');
  playlistElement.innerHTML = '';

  for (const trackId of trackIds) {
    const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const track = await trackResponse.json();
    const listItem = document.createElement('li');
    listItem.textContent = `${track.name} - ${track.artists[0].name}`;
    playlistElement.appendChild(listItem);
  }
}

(async () => {
  const urlHash = window.location.hash.substring(1);
  const params = new URLSearchParams(urlHash);
  const accessToken = params.get('access_token');

  if (!accessToken) {
    document.getElementById('authenticate').style.display = 'block';
    document.getElementById('fileSelection').style.display = 'none';
  } else {
    document.getElementById('authenticate').style.display = 'none';
    document.getElementById('fileSelection').style.display = 'block';
  }

  if (!accessToken) return;

  document.getElementById('authenticate').style.display = 'none';
  document.getElementById('fileSelection').style.display = 'block';

  document.getElementById('submitChatInput').addEventListener('click', async () => {
    const chatInput = document.getElementById('chatInput').value.trim();
    if (!chatInput) return;

    const gptSuggestions = await fetchGptSuggestions(chatInput);
    const trackList = extractTrackListFromGptSuggestion(gptSuggestions);
    const trackIds = [];

    for (const track of trackList) {
      const trackId = await searchTrack(accessToken, track.artist, track.title);
      if (trackId) {
        trackIds.push(trackId);
      }
    }

    const userProfileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const userProfile = await userProfileResponse.json();
    const playlistUrl = await createPlaylist(accessToken, userProfile.id, trackIds);

    // Call the createTextPlaylist function to render the text playlist
    await createTextPlaylist(accessToken, trackList, trackIds);

    // Open the generated playlist in a new window
    window.open(playlistUrl, '_blank');
  });
})();
