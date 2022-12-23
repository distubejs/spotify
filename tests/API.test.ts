import { API } from "@/API";

const TRACK_URL = "https://open.spotify.com/track/6Fbsn9471Xd0vVsMWwhePh?si=f992e1fe1f714674";
const ALBUM_URL = "https://open.spotify.com/album/5Gu0Ldddj2f6a0q5gitIok?si=781b3339b2bc4015";
const PLAYLIST_URL = "https://open.spotify.com/playlist/1IetTTs69jS1MQ3U6yxofB?si=182a1e01ff374fc8";
const ARTIST_URL = "https://open.spotify.com/artist/3FwYnbtGNt8hJfjNuOfpeG?si=d4c1d832636c4bb1";
const LONG_PLAYLIST_URL = "https://open.spotify.com/playlist/0HlfmkivifBxTcNeoev41s?si=8f7aa0dac31a406d";
const LONG_ALBUM_URL = "https://open.spotify.com/album/1fnZbc8ZrgyW6RpFvwXkwl";

const PRIVATE_ID = "1CReGsrMUgMQXinhawwIKX";

const expectTrack = {
  type: "track",
  name: expect.any(String),
  artists: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]),
};

const expectList = (type: "track" | "album" | "playlist" | "artist" | string) =>
  type === "track"
    ? expectTrack
    : {
        type,
        name: expect.any(String),
        thumbnail: expect.any(String),
        url: expect.any(String),
        tracks: expect.arrayContaining([expect.objectContaining(expectTrack)]),
      };

describe.each([
  ["Without", undefined, undefined],
  ["With", process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET],
])("%s client credentials", (_name, clientId, clientSecret) => {
  describe.each([
    ["Using spotify api", true],
    ["Using spotify embed", false],
  ])("%s", (_name, useAPI) => {
    const api = new API(clientId, clientSecret, "VN");
    if (useAPI) {
      test("refreshToken", async () => {
        await api.refreshToken();
        expect(api["_tokenAvailable"]).toBe(true);
        expect(api["_hasCredentials"]).toBe(!!(clientId && clientSecret));
        expect(api["_expirationTime"]).toBeGreaterThan(Date.now());
      });
    } else {
      api["_tokenAvailable"] = false;
      api["_hasCredentials"] = false;
      api["_expirationTime"] = Infinity;
    }

    describe("getData", () => {
      test.each([
        ["track", TRACK_URL],
        ["album", ALBUM_URL],
        ["playlist", PLAYLIST_URL],
        ["artist", ARTIST_URL],
      ])("get %s", async (type, url) => {
        const data = await api.getData(url);
        expect(data).toMatchObject(expectList(type));
        if (data.type !== "track") {
          expect(data.tracks.length).toBeGreaterThanOrEqual(1);
          expect(data.tracks).not.toContain(null);
          expect(data.tracks).not.toContainEqual(expect.objectContaining({ type: expect.not.stringMatching("track") }));
        }
      });

      test.each([
        ["playlist", LONG_PLAYLIST_URL, 900],
        ["album", LONG_ALBUM_URL, 50],
      ])(
        "get long %s",
        async (type, url, length) => {
          const data = await api.getData(url);
          expect(data).toMatchObject(expectList(type));
          expect(data.type).toBe(type);
          if (data.type !== "track") {
            expect(data.tracks.length).toBeGreaterThanOrEqual(useAPI ? length : 100);
          }
        },
        15_000,
      );
    });
  });
});

describe("API error handling", () => {
  const api = new API();

  test("refreshToken", async () => {
    await api.refreshToken();
    expect(api["_tokenAvailable"]).toBe(true);
    expect(api["_hasCredentials"]).toBe(false);
    expect(api["_expirationTime"]).toBeGreaterThan(Date.now());
  });

  test.each([
    ["track", `https://open.spotify.com/track/${PRIVATE_ID}`],
    ["album", `https://open.spotify.com/album/${PRIVATE_ID}`],
    ["playlist", `https://open.spotify.com/playlist/${PRIVATE_ID}`],
    ["artist", `https://open.spotify.com/artist/${PRIVATE_ID}`],
  ])("private %s", async (_type, url) => {
    await expect(api.getData(url)).rejects.toThrow("The URL is private or unavailable.");
  });
});
