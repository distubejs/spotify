import { SpotifyPlugin } from "..";

test.todo("Validate Options");
test.todo("SpotifyPlugin#play()");
test("SpotifyPlugin#validate()", () => {
  const { validate } = new SpotifyPlugin();
  const validUrls = [
    "https://open.spotify.com/artist/3FwYnbtGNt8hJfjNuOfpeG?si=d4c1d832636c4bb1",
    "https://open.spotify.com/album/5Gu0Ldddj2f6a0q5gitIok?si=781b3339b2bc4015",
    "https://open.spotify.com/track/6Fbsn9471Xd0vVsMWwhePh?si=f992e1fe1f714674",
    "https://open.spotify.com/playlist/37i9dQZEVXbLdGSmz6xilI?si=28a3d4be17304ade",
  ];
  validUrls.forEach(url => {
    expect(validate(url)).resolves.toBe(true);
  });
  const invalidUrls = [
    "https://open.spotify.com/show/6vcyNclFEFyS2pVSKFEWJo?si=893aa44bd6504cf9",
    "https://open.spotify.com/episode/42wDq6xhm7vbqD3glD1JSd?si=6016d24bf1b54793",
    "https://open.spotify.com/not-a-type/42wDq6xhm7vbqD3glD1JSd?si=6016d24bf1b54793",
    "https://open.spotify.com/",
    "https://www.youtube.com/watch?v=fzcIk6zN-M4",
    "not a url",
  ];
  invalidUrls.forEach(url => {
    expect(validate(url)).resolves.toBe(false);
  });
});
