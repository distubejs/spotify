# @distube/spotify

A DisTube custom plugin for supporting Spotify URL.

## Status: beta

Requires DisTube v3.0.0-beta

# Feature

This plugin grabs the songs on Spotify then searches on YouTube and play with DisTube.

# Installation

```sh
npm install @distube/spotify
```

# Usage

```js
const Discord = require("discord.js");
const DisTube = require("distube");
const SpotifyPlugin = require("@distube/spotify");
const client = new Discord.Client();
const distube = new DisTube(client, {
  searchSongs: 10,
  emitNewSongOnly: true,
  plugins: [new SpotifyPlugin()],
});

// Now distube.play can play spotify url.

client.on("message", message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;
  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift();
  if (command === "play") distube.play(message, args.join(" "));
});
```

## Documentation

### SpotifyPlugin([options])

- `options.parallel`: Default is `true`. Whether or not searching the playlist in parallel.
- `options.emitPlaySongAfterFetching`: Default is `false`. Emit `playSong` event before or after fetching all the songs.
  > If `false`, DisTube plays the first song -> emits `playSong` events -> fetches all the rest\
  > If `true`, DisTube plays the first song -> fetches all the rest -> emits `playSong` events
- `options.api`: (Optional) Spotify API Client credentials. Uses to fetch playlists/albums more than Spotify embeds limit (100 songs).
  - `options.api.clientId`: Client ID of your Spotify application
  - `options.api.clientSecret`: Client Secret of your Spotify application

```js
new SpotifyPlugin({
  parallel: true,
  emitPlaySongAfterFetching: false,
  api: {
    clientId: "SpotifyAppClientID",
    clientSecret: "SpotifyAppClientSecret",
  },
});
```
