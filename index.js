const spotify = require("spotify-url-info");
const spotifyURI = require("spotify-uri");
const { CustomPlugin, Song, Playlist } = require("distube");
const SUPPORTED_TYPES = ["album", "artist", "playlist", "track"];

module.exports = class SpotifyPlugin extends CustomPlugin {
  constructor(options = {}) {
    super();
    this.parallel = typeof options.parallel === "boolean" ? options.parallel : true;
    this.emitPlaySongAfterFetching = !!options.emitPlaySongAfterFetching;
  }

  validate(url) {
    if (typeof url !== "string" || !url.includes("spotify")) return false;
    let parsedURL = {};
    try {
      parsedURL = spotifyURI.parse(url);
    } catch (error) {
      return false;
    }
    if (!parsedURL.type || !SUPPORTED_TYPES.includes(parsedURL.type)) return false;
    return true;
  }

  async play(voiceChannel, url, member, textChannel, skip, unshift) {
    const DT = this.distube;
    const data = await spotify.getData(url);
    if (data.type === "track") {
      const query = `${data.name} ${data.artists.map(a => a.name).join(" ")}`;
      const result = await this.search(query);
      if (!result) throw new Error(`[SpotifyPlugin] Cannot find "${query}" on YouTube.`);
      await DT.playVoiceChannel(voiceChannel, result, { member, textChannel, skip });
    } else {
      const playlist = resolvePlaylist(data, member);
      let firstSong;
      while (!firstSong && playlist.songs.length) {
        const result = await this.search(playlist.songs.shift());
        if (!result) continue;
        firstSong = new Song(result, member)._patchPlaylist(playlist);
      }

      if (!firstSong && !playlist.songs.length) {
        throw new Error(`[SpotifyPlugin] Cannot find any tracks of "${playlist.name}" on YouTube.`);
      }
      let queue = DT.getQueue(voiceChannel);

      const fetchTheRest = async () => {
        if (playlist.songs.length) {
          if (this.parallel) {
            playlist.songs = await Promise.all(playlist.songs.map(query => this.search(query)));
          } else {
            for (const i in playlist.songs) {
              playlist.songs[i] = await this.search(playlist.songs[i]);
            }
          }
          playlist.songs = playlist.songs.filter(r => r).map(r => new Song(r, member)._patchPlaylist(playlist));
          queue.addToQueue(playlist.songs, skip ? 1 : unshift ? 2 : -1);
        }
        playlist.songs.unshift(firstSong);
      };

      if (queue) {
        queue.addToQueue(firstSong, skip || unshift ? 1 : -1);
        if (skip) queue.skip();
        await fetchTheRest(unshift);
        if (!skip) DT.emit("addList", queue, playlist);
      } else {
        queue = await DT.handler.createQueue(voiceChannel, firstSong, textChannel);
        if (queue === true) return;
        if (!this.emitPlaySongAfterFetching) DT.emit("playSong", queue, firstSong);
        await new Promise(resolve => {
          const check = setInterval(() => {
            if (Array.isArray(queue.songs) && queue.songs[0]?.streamURL) resolve(clearInterval(check));
          }, 500);
        });
        await fetchTheRest();
        if (this.emitPlaySongAfterFetching) DT.emit("playSong", queue, firstSong);
      }
    }
  }

  async search(query) {
    try {
      return (await this.distube.search(query, { limit: 1 }))[0];
    } catch {
      return null;
    }
  }
};

const resolvePlaylist = (data, member) => {
  const songs = (data.tracks.items || data.tracks)
    .map(item => {
      const track = item.track || item;
      if (track.type !== "track") return null;
      return `${track.name} ${track.artists.map(a => a.name).join(" ")}`;
    })
    .filter(Boolean);
  if (!songs.length) throw new Error(`[SpotifyPlugin] \`${data.name}\` does not contains any tracks.`);
  return new Playlist(
    {
      name: data.name,
      thumbnail: data.images[0].url,
      url: data.external_urls?.spotify || "",
      songs,
    },
    member,
  );
};
