const clientId = '5a5cb54595bf495f805181938026b529';
const redirectUri = 'https://FormanRubyDubloon.github.io/spotify-playlist-generator.github.io/callback';
const scopes = 'playlist-modify-public';

function onAuthenticateButtonClick() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location.href = authUrl;
}

document.getElementById('authenticate').addEventListener('click', onAuthenticateButtonClick);

function parseCSV(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        resolve(results.data);
      },
    });
  });
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
  const uris = tracks.map(track => `spotify:track:${track.spotify_id}`);

  await fetch(`${apiBaseUrl}/playlists/${playlist.id}/tracks`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ uris }),
  });

  return playlist.external_urls.spotify;
}

(async () => {
  const urlHash = window.location.hash.substring(1);
  if (!urlHash) return;

  const params = new URLSearchParams(urlHash);
  const accessToken = params.get('access_token');
  if (!accessToken) return;

  // Hide the "Authenticate" button and show the "File Selection" after authentication
  document.getElementById('authenticate').style.display = 'none';
  document.getElementById('fileSelection').style.display = 'block';

  document.getElementById('generatePlaylist').addEventListener('click', async () => {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    if (!file) return;

    const tracks = await parseCSV(file);
    const userProfileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const userProfile = await userProfileResponse.json();
    const playlistUrl = await createPlaylist(accessToken, userProfile.id, tracks);
    window.location.href = playlistUrl;
  });
})();

