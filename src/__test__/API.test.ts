import { API } from "../API";

const TRACK_URL = "https://open.spotify.com/track/6Fbsn9471Xd0vVsMWwhePh?si=f992e1fe1f714674";
const ALBUM_URL = "https://open.spotify.com/album/5Gu0Ldddj2f6a0q5gitIok?si=781b3339b2bc4015";
const PLAYLIST_URL = "https://open.spotify.com/playlist/37i9dQZEVXbLdGSmz6xilI?si=28a3d4be17304ade";
const ARTIST_URL = "https://open.spotify.com/artist/3FwYnbtGNt8hJfjNuOfpeG?si=d4c1d832636c4bb1";
const LONG_PLAYLIST_URL = "https://open.spotify.com/playlist/0HlfmkivifBxTcNeoev41s?si=8f7aa0dac31a406d";
const LONG_ALBUM_URL = "https://open.spotify.com/album/1fnZbc8ZrgyW6RpFvwXkwl";

const expectToMatchList = (type: "album" | "playlist" | "artist") => ({
  type,
  name: expect.any(String),
  thumbnail: expect.any(String),
  url: expect.any(String),
  tracks: expect.arrayContaining([
    expect.objectContaining({
      name: expect.any(String),
      artists: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]),
    }),
  ]),
});

describe("Without client credentials", () => {
  describe("Can get the token", () => {
    const api = new API();

    test("refreshToken", async () => {
      await api.refreshToken();
      expect(api["_tokenAvailable"]).toBe(true);
      expect(api["_expirationTime"]).toBeGreaterThan(Date.now());
      expect(api["_hasCredentials"]).toBe(false);
    });

    describe("getData", () => {
      test("track", async () => {
        const trackData = await api.getData(TRACK_URL);
        expect(trackData).toMatchObject({
          type: "track",
          name: expect.any(String),
          artists: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]),
        });
      });

      test("album", async () => {
        const albumData = await api.getData(ALBUM_URL);
        expect(albumData).toMatchObject(expectToMatchList("album"));
      });

      test("playlist", async () => {
        const playlistData = await api.getData(PLAYLIST_URL);
        expect(playlistData).toMatchObject(expectToMatchList("playlist"));
      });

      test("artist", async () => {
        const artistData = await api.getData(ARTIST_URL);
        expect(artistData).toMatchObject(expectToMatchList("artist"));
      });

      test("long playlist", async () => {
        const longPlaylistData = await api.getData(LONG_PLAYLIST_URL);
        expect(longPlaylistData).toMatchObject(expectToMatchList("playlist"));
        if (longPlaylistData.type === "playlist") expect(longPlaylistData.tracks.length).toBeGreaterThan(900);
      }, 15_000);
      test("long album", async () => {
        const longAlbumData = await api.getData(LONG_ALBUM_URL);
        expect(longAlbumData).toMatchObject(expectToMatchList("album"));
        if (longAlbumData.type === "album") expect(longAlbumData.tracks.length).toBeGreaterThan(50);
      }, 15_000);
    });
  });

  describe("Can't get the token", () => {
    const api = new API();
    api["_tokenAvailable"] = false;
    api["_expirationTime"] = Infinity;
    api["_hasCredentials"] = false;

    describe("getData", () => {
      test("track", async () => {
        const trackData = await api.getData(TRACK_URL);
        expect(trackData).toMatchObject({
          type: "track",
          name: expect.any(String),
          artists: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]),
        });
      });

      test("album", async () => {
        const albumData = await api.getData(ALBUM_URL);
        expect(albumData).toMatchObject(expectToMatchList("album"));
      });

      test("playlist", async () => {
        const playlistData = await api.getData(PLAYLIST_URL);
        expect(playlistData).toMatchObject(expectToMatchList("playlist"));
      });

      test("artist", async () => {
        const artistData = await api.getData(ARTIST_URL);
        expect(artistData).toMatchObject(expectToMatchList("artist"));
      });

      test("long playlist", async () => {
        const longPlaylistData = await api.getData(LONG_PLAYLIST_URL);
        expect(longPlaylistData).toMatchObject(expectToMatchList("playlist"));
        if (longPlaylistData.type === "playlist") expect(longPlaylistData.tracks.length).toBeGreaterThanOrEqual(100);
      }, 15_000);
      test("long album", async () => {
        const longAlbumData = await api.getData(LONG_ALBUM_URL);
        expect(longAlbumData).toMatchObject(expectToMatchList("album"));
        if (longAlbumData.type === "album") expect(longAlbumData.tracks.length).toBeGreaterThanOrEqual(50);
      }, 15_000);
    });
  });
});

describe("With client credentials", () => {
  const api = new API(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET, "VN");

  test("refreshToken", async () => {
    await api.refreshToken();
    expect(api["_tokenAvailable"]).toBe(true);
    expect(api["_expirationTime"]).toBeGreaterThan(Date.now());
    expect(api["_hasCredentials"]).toBe(true);
  });

  describe("getData", () => {
    test("track", async () => {
      const trackData = await api.getData(TRACK_URL);
      expect(trackData).toMatchObject({
        type: "track",
        name: expect.any(String),
        artists: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]),
      });
    });

    test("album", async () => {
      const albumData = await api.getData(ALBUM_URL);
      expect(albumData).toMatchObject(expectToMatchList("album"));
    });

    test("playlist", async () => {
      const playlistData = await api.getData(PLAYLIST_URL);
      expect(playlistData).toMatchObject(expectToMatchList("playlist"));
    });

    test("artist", async () => {
      const artistData = await api.getData(ARTIST_URL);
      expect(artistData).toMatchObject(expectToMatchList("artist"));
    });

    test("long playlist", async () => {
      const longPlaylistData = await api.getData(LONG_PLAYLIST_URL);
      expect(longPlaylistData).toMatchObject(expectToMatchList("playlist"));
      if (longPlaylistData.type === "playlist") expect(longPlaylistData.tracks.length).toBeGreaterThan(900);
    }, 15_000);
    test("long album", async () => {
      const longAlbumData = await api.getData(LONG_ALBUM_URL);
      expect(longAlbumData).toMatchObject(expectToMatchList("album"));
      if (longAlbumData.type === "album") expect(longAlbumData.tracks.length).toBeGreaterThan(50);
    }, 15_000);
  });
});
