import { parse as parseSpotifyURI } from "spotify-uri";
import fetch from "isomorphic-unfetch";
import SpotifyUrlInfo from "spotify-url-info";
import SpotifyWebApi from "spotify-web-api-node";
import { CustomPlugin, DisTubeError, Playlist, Song, checkInvalidKey } from "distube";
import type { VoiceBasedChannel } from "discord.js";
import type { PlayOptions, PlaylistInfo, Queue, SearchResult } from "distube";

const SUPPORTED_TYPES = ["album", "artist", "playlist", "track"];
const API = new SpotifyWebApi();
const spotify = SpotifyUrlInfo(fetch);
let expirationTime = 0;

declare type SpotifyPluginOptions = {
  api?: {
    clientId: string;
    clientSecret: string;
  };
  parallel?: boolean;
  emitEventsAfterFetching?: boolean;
};

type Falsy = undefined | null | false | 0 | "";
const isTruthy = <T>(x: T | Falsy): x is T => Boolean(x);

const getItems = async (data: any): Promise<any[]> => {
  if (!data.tracks.items) return data.tracks;
  const items: any[] = data.tracks.items;
  if (!["playlist", "album"].includes(data.type)) return items;
  while (data.tracks.next) {
    if (!expirationTime) break;
    if (expirationTime <= Date.now() - 1000) {
      const res = await API.clientCredentialsGrant();
      expirationTime = Date.now() + res.body.expires_in;
      API.setAccessToken(res.body.access_token);
    }
    try {
      data.tracks = (
        await API[data.type === "playlist" ? "getPlaylistTracks" : "getAlbumTracks"](data.id, {
          offset: data.tracks.offset + data.tracks.limit,
          limit: 100,
        })
      ).body;
    } catch (e: any) {
      process.emitWarning(`${e?.message}`, "SpotifyAPI");
      process.emitWarning("There is a Spotify API error, max songs of Spotify playlist is 100.", "SpotifyPlugin");
      break;
    }
    items.push(...data.tracks.items);
  }
  return items;
};

export class SpotifyPlugin extends CustomPlugin {
  parallel: boolean;
  emitEventsAfterFetching: boolean;
  constructor(options: SpotifyPluginOptions = {}) {
    super();
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new DisTubeError("INVALID_TYPE", ["object", "undefined"], options, "SpotifyPluginOptions");
    }
    checkInvalidKey(options, ["parallel", "emitEventsAfterFetching", "api"], "SpotifyPluginOptions");
    this.parallel = options.parallel ?? true;
    if (typeof this.parallel !== "boolean") {
      throw new DisTubeError("INVALID_TYPE", "boolean", this.parallel, "parallel");
    }
    this.emitEventsAfterFetching = options.emitEventsAfterFetching ?? false;
    if (typeof this.emitEventsAfterFetching !== "boolean") {
      throw new DisTubeError("INVALID_TYPE", "boolean", this.emitEventsAfterFetching, "emitEventsAfterFetching");
    }
    API.setAccessToken("");
    if (options.api !== undefined && (typeof options.api !== "object" || Array.isArray(options.api))) {
      throw new DisTubeError("INVALID_TYPE", ["object", "undefined"], options.api, "api");
    } else if (options.api) {
      if (typeof options.api.clientId !== "string") {
        throw new DisTubeError("INVALID_TYPE", "string", options.api.clientId, "api.clientId");
      }
      if (typeof options.api.clientSecret !== "string") {
        throw new DisTubeError("INVALID_TYPE", "string", options.api.clientSecret, "api.clientSecret");
      }
      API.setClientId(options.api.clientId);
      API.setClientSecret(options.api.clientSecret);
      API.clientCredentialsGrant()
        .then(data => {
          expirationTime = Date.now() + data.body.expires_in;
          API.setAccessToken(data.body.access_token);
        })
        .catch(e => {
          /* eslint-disable no-console */
          console.error(e);
          console.warn("[SpotifyPlugin]: Cannot get Spotify access Token from your api info. Disabled API feature!");
          /* eslint-enable no-console */
        });
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async validate(url: string) {
    if (typeof url !== "string" || !url.includes("spotify")) return false;
    try {
      const parsedURL = parseSpotifyURI(url);
      if (!parsedURL.type || !SUPPORTED_TYPES.includes(parsedURL.type)) return false;
      return true;
    } catch (error) {
      return false;
    }
  }

  async play(voiceChannel: VoiceBasedChannel, url: string, options: PlayOptions) {
    const DT = this.distube;
    const data = await spotify.getData(url);
    const { member, textChannel, skip, position, metadata } = Object.assign({ position: 0 }, options);
    if (data.type === "track") {
      const query = `${data.name} ${data.artists.map((a: any) => a.name).join(" ")}`;
      const result = await this.search(query);
      if (!result) throw new DisTubeError("SPOTIFY_PLUGIN_NO_RESULT", `Cannot find "${query}" on YouTube.`);
      await DT.play(voiceChannel, result, options);
    } else {
      const name = data.name;
      const thumbnail = data.images[0]?.url;
      const queries: string[] = (await getItems(data))
        .map(item => {
          const track = item.track || item;
          if (track.type !== "track") return null;
          return `${track.name} ${track.artists.map((a: any) => a.name).join(" ")}`;
        })
        .filter(isTruthy);
      let firstSong: Song | undefined;
      const getFirstSong = async () => {
        const firstQuery = queries.shift();
        if (!firstQuery) return;
        const result = await this.search(firstQuery);
        if (!result) return;
        firstSong = new Song(result, { member, metadata });
      };
      while (!firstSong) {
        await getFirstSong();
      }

      if (!firstSong) {
        throw new DisTubeError("SPOTIFY_PLUGIN_NO_RESULT", `Cannot find any tracks of "${name}" on YouTube.`);
      }
      const queue = DT.getQueue(voiceChannel);

      const playlistInfo: PlaylistInfo = {
        source: "spotify",
        songs: [firstSong],
        name,
        thumbnail,
        member,
        url: data.external_urls.spotify,
      };
      const playlist = new Playlist(playlistInfo, { member, metadata });
      const fetchTheRest = async (q: Queue, fs: Song) => {
        if (queries.length) {
          let results: (SearchResult | null)[] = [];
          if (this.parallel) {
            results = await Promise.all(queries.map(query => this.search(query)));
          } else {
            for (let i = 0; i < queries.length; i++) {
              results[i] = await this.search(queries[i]);
            }
          }
          playlist.songs = results.filter(isTruthy).map(r => {
            const s = new Song(r, { member, metadata });
            s.playlist = playlist;
            return s;
          });
          q.addToQueue(playlist.songs, !skip && position > 0 ? position + 1 : position);
        }
        playlist.songs.unshift(fs);
      };
      if (queue) {
        queue.addToQueue(firstSong, position);
        if (skip) queue.skip();
        else if (!this.emitEventsAfterFetching) DT.emit("addList", queue, playlist);
        await fetchTheRest(queue, firstSong);
        if (!skip && this.emitEventsAfterFetching) DT.emit("addList", queue, playlist);
      } else {
        let newQueue = await DT.queues.create(voiceChannel, firstSong, textChannel);
        while (newQueue === true) {
          await getFirstSong();
          newQueue = await DT.queues.create(voiceChannel, firstSong, textChannel);
        }
        if (!this.emitEventsAfterFetching) {
          if (DT.options.emitAddListWhenCreatingQueue) DT.emit("addList", newQueue, playlist);
          DT.emit("playSong", newQueue, firstSong);
        }
        await fetchTheRest(newQueue, firstSong);
        if (this.emitEventsAfterFetching) {
          if (DT.options.emitAddListWhenCreatingQueue) DT.emit("addList", newQueue, playlist);
          DT.emit("playSong", newQueue, firstSong);
        }
      }
    }
  }

  async search(query: string) {
    try {
      return (await this.distube.search(query, { limit: 1 }))[0];
    } catch {
      return null;
    }
  }
}

export default SpotifyPlugin;
