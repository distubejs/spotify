# @distube/spotify
 A DisTube custom plugin for supporting Spotify URL.
 Required DisTube version >= 3.0.0

# Feature
 This plugin grabs the songs on Spotify then searches on YouTube and play the song with DisTube.

# Usage
```js
const Discord = require('discord.js')
const DisTube = require('distube')
const SpotifyPlugin = require("@distube/spotify")
const client = new Discord.Client()
const distube = new DisTube(client, {
    searchSongs: 10,
    emitNewSongOnly: true,
    plugins: [new SpotifyPlugin({ parallel: true })]
})

// Now distube.play can play spotify url.

client.on('message', message => {
	if (message.author.bot) return
	if (!message.content.startsWith(config.prefix)) return
	const args = message.content.slice(config.prefix.length).trim().split(/ +/g)
	const command = args.shift()
	if (command === 'play') distube.play(message, args.join(' '))
})
```

# Documentation

## SpotifyPlugin([options])
- `options.parallel`: Default is `true`. Whether or not searching the playlist in parallel.