const spotify = require("spotify-url-info");
const spotifyURI = require("spotify-uri");
const { CustomPlugin, Song, Playlist } = require("distube");
const SUPPORTED_TYPES = ["album", "artist", "playlist", "track"];

module.exports = class SpotifyPlugin extends CustomPlugin {
  constructor(options = {}) {
    super();
    this.parallel = typeof options.parallel === "boolean" ? options.parallel : true;
  }

  validate(url) {
    if (typeof url !== "string") return false;
    let parsedURL = {};
    try {
      parsedURL = spotifyURI.parse(url);
    } catch (error) {
      return false;
    }
    if (!parsedURL.type || !SUPPORTED_TYPES.includes(parsedURL.type)) return false;
    return true;
  }

  async play(message, url, skip) {
    const DT = this.distube;
    const data = await spotify.getData(url);
    if (data.type === "track") {
      const query = `${data.name} ${data.artists.map(a => a.name).join(" ")}`;
      const result = await DT.search(query).catch(() => undefined);
      if (!Array.isArray(result)) throw new Error(`Cannot find "${query}" on YouTube.`);
      await DT.play(message, result[0], skip);
    } else {
      const playlist = resolvePlaylist(data, message.member);
      let firstSong;
      while (!firstSong && playlist.songs.length) {
        const result = await this.search(playlist.songs.shift());
        if (!result) continue;
        firstSong = new Song(result, message.member)._patchPlaylist(playlist);
      }

      if (!firstSong && !playlist.songs.length) throw new Error(`Cannot find any tracks of "${playlist.name}" on YouTube.`);
      let queue = DT.getQueue(message);

      const fetchTheRest = async () => {
        if (playlist.songs.length) {
          if (this.parallel) {
            playlist.songs = await Promise.all(playlist.songs.map(query => this.search(query)));
          } else {
            for (const i in playlist.songs) {
              playlist.songs[i] = await this.search(playlist.songs[i]);
            }
          }
          playlist.songs = playlist.songs.filter(r => r)
            .map(r => new Song(r, message.member)._patchPlaylist(playlist));
          queue.addToQueue(playlist.songs, skip);
        }
        playlist.songs.unshift(firstSong);
      };

      if (queue) {
        queue.addToQueue(firstSong, skip);
        if (skip) queue.skip();
        await fetchTheRest();
      } else {
        queue = await DT._newQueue(message, firstSong);
        if (queue === true) return;
        DT.emit("playSong", queue, firstSong);
        await new Promise(resolve => {
          const check = setInterval(() => {
            if (Array.isArray(queue.songs) && queue.songs[0]?.streamURL) resolve(clearInterval(check));
          }, 500);
        });
        await fetchTheRest();
      }
    }
  }

  async search(query) {
    try {
      return (await this.distube.search(query, { limit: 1 }))[0];
    } catch { return null }
  }
};

const resolvePlaylist = (data, member) => new Playlist({
  name: data.name,
  thumbnail: data.images[0].url,
  url: data.external_urls?.spotify || "",
  songs: data.tracks.items.map(item => {
    const track = item.track || item;
    return `${track.name} ${track.artists.map(a => a.name).join(" ")}`;
  }),
}, member);
