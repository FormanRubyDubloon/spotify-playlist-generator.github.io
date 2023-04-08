const clientId = '5a5cb54595bf495f805181938026b529';
const redirectUri = 'https://FormanRubyDubloon.github.io/spotify-playlist-generator.github.io/';
const scopes = 'playlist-modify-public';

function onAuthenticateButtonClick() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location.href = authUrl;
}

document.getElementById('authenticate').addEventListener('click', onAuthenticateButtonClick);


async function fetchGptSuggestions(prompt) {
  const response = await fetch('https://api.openai.com/v1/engines/davinci-codex/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer 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',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt,
      max_tokens: 100,
      n: 1,
      stop: null,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  return data.choices[0].text;
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
  let textPlaylistContent = '';

  for (const track of trackList) {
    const trackId = await searchTrack(accessToken, track.artist, track.title);
    if (trackId) {
      textPlaylistContent += `${track.artist} - ${track.title}\n`;
    }
  }

  const textPlaylistDiv = document.getElementById('textPlaylist');
  textPlaylistDiv.innerText = textPlaylistContent;
  textPlaylistDiv.style.display = 'block';
}

(async () => {
  const urlHash = window.location.hash.substring(1);
  if (!urlHash) return;

  const params = new URLSearchParams(urlHash);
  const accessToken = params.get('access_token');
  if (!accessToken) return;

  document.getElementById('authenticate').style.display = 'none';
  document.getElementById('fileSelection').style.display = 'block';

document.getElementById('generatePlaylist').addEventListener('click', async () => {
  const chatInput = document.getElementById('gptChatInput').value;
  if (!chatInput) return;

  const gptSuggestions = await fetchGptSuggestions(chatInput);
  const lines = gptSuggestions.split('\n').filter(line => line.trim());

  const trackList = lines.map(line => {
    const [artist, title] = line.split('-').map(s => s.trim());
    return { artist, title };
  });

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

  await createTextPlaylist(accessToken, trackList, trackIds);

  window.open(playlistUrl, '_blank');
});

})();
