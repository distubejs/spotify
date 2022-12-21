import { API } from "./API";
import { CustomPlugin, DisTubeError, Playlist, Song, checkInvalidKey } from "distube";
import type { VoiceBasedChannel } from "discord.js";
import type { PlayOptions, PlaylistInfo, Queue, SearchResult } from "distube";

type Falsy = undefined | null | false | 0 | "";
const isTruthy = <T>(x: T | Falsy): x is T => Boolean(x);

export type SpotifyPluginOptions = {
  api?: {
    clientId?: string;
    clientSecret?: string;
    topTracksCountry?: string;
  };
  parallel?: boolean;
  emitEventsAfterFetching?: boolean;
};

export class SpotifyPlugin extends CustomPlugin {
  api: API;
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
      throw new DisTubeError("INVALID_TYPE", "boolean", this.parallel, "SpotifyPluginOptions.parallel");
    }
    this.emitEventsAfterFetching = options.emitEventsAfterFetching ?? false;
    if (typeof this.emitEventsAfterFetching !== "boolean") {
      throw new DisTubeError(
        "INVALID_TYPE",
        "boolean",
        this.emitEventsAfterFetching,
        "SpotifyPluginOptions.emitEventsAfterFetching",
      );
    }
    if (options.api !== undefined && (typeof options.api !== "object" || Array.isArray(options.api))) {
      throw new DisTubeError("INVALID_TYPE", ["object", "undefined"], options.api, "api");
    } else if (options.api) {
      if (options.api.clientId && typeof options.api.clientId !== "string") {
        throw new DisTubeError("INVALID_TYPE", "string", options.api.clientId, "SpotifyPluginOptions.api.clientId");
      }
      if (options.api.clientSecret && typeof options.api.clientSecret !== "string") {
        throw new DisTubeError(
          "INVALID_TYPE",
          "string",
          options.api.clientSecret,
          "SpotifyPluginOptions.api.clientSecret",
        );
      }
      if (options.api.topTracksCountry && typeof options.api.topTracksCountry !== "string") {
        throw new DisTubeError(
          "INVALID_TYPE",
          "string",
          options.api.topTracksCountry,
          "SpotifyPluginOptions.api.topTracksCountry",
        );
      }
    }
    this.api = new API(options.api?.clientId, options.api?.clientSecret, options.api?.topTracksCountry);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async validate(url: string) {
    if (typeof url !== "string" || !url.includes("spotify")) return false;
    try {
      const parsedURL = this.api.parseUrl(url);
      if (!parsedURL.type || !this.api.isSupportedTypes(parsedURL.type)) return false;
      return true;
    } catch (error) {
      return false;
    }
  }

  async play(voiceChannel: VoiceBasedChannel, url: string, options: PlayOptions) {
    const DT = this.distube;
    const data = await this.api.getData(url);
    const { member, textChannel, skip, position, metadata } = Object.assign({ position: 0 }, options);
    if (data.type === "track") {
      const query = `${data.name} ${data.artists.map((a: any) => a.name).join(" ")}`;
      const result = await this.search(query);
      if (!result) throw new DisTubeError("SPOTIFY_PLUGIN_NO_RESULT", `Cannot find "${query}" on YouTube.`);
      await DT.play(voiceChannel, result, options);
    } else {
      const { name, thumbnail, tracks } = data;
      const queries: string[] = tracks
        .map(track => {
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
      while (!firstSong) await getFirstSong();

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
        url,
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
