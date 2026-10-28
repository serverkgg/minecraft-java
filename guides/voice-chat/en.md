## What voice chat does

Voice chat lets you talk to your friends by voice on your server. Players near you in the game hear you.

We install the `Simple Voice Chat` mod for you and keep it updated on every start. We also open its own voice port and write it into the mod's settings. All you do is turn on one switch.

> [!note] Voice chat works on Paper, Purpur, Fabric, Forge and NeoForge. If your server is Vanilla, switch the type from the Version tab first.

## Turn it on

In the **Settings** tab, turn on **In-game voice chat** and save. The server restarts right away, and the first start takes a moment while the mod downloads.

@[open](panel:settings)

If the download fails, or the mod has no build for your server's version yet, your server still starts without voice chat and prints a warning line in the console. The switch stays on, and voice chat comes back on its own on the first start where the mod is available.

## Every player installs the mod

Voice chat doesn't reach a player without the mod. Each player installs `Simple Voice Chat` in their game, for the same version your server runs:

@[field](server.version)

1. Install a mod loader in your game, such as Fabric or NeoForge, or use the Modrinth app or the CurseForge app
2. Download Simple Voice Chat from https://modrinth.com/mod/simple-voice-chat for your server's version and the mod loader you picked
3. Start the game and join your server with the usual address

On Paper and Purpur too, players install the mod in their game, and we install the plugin on the server.

The first time a player uses it, the mod shows a short setup where they pick how the microphone turns on: **Push to Talk**, where you hold a key while you speak, or **Voice Activation**, which turns the microphone on when you speak.

A player without the mod still joins and plays as usual, but they can't hear or speak in voice chat.

## The voice port

Players don't type the voice port anywhere. They join your server with the same address:

@[field](server.address)

The mod then sends the voice port to their game, and it connects on its own. The voice address appears on your server page next to the Java one while voice chat is on, for reference only. While it's off, or on a Vanilla server, nothing is listening on that port, so we don't show it.

## Check whether voice works

After the restart, watch the console for the line the mod prints when its voice server starts. It ends with the same voice port your server page shows:

```txt
[voicechat] Voice chat server started at port 26300
```

## The mod's settings

We write only two lines in the mod's settings file, `port` and `voice_host`, and write them again before every start. The file is `plugins/voicechat/voicechat-server.properties` on Paper and Purpur, and `config/voicechat/voicechat-server.properties` on Fabric, Forge and NeoForge. Change the other settings in it as you like, such as `max_voice_distance`, how many blocks a voice carries, which starts at 48. Then restart.

## Bedrock players

> [!warning] If crossplay is on, Bedrock players join your server, but they can't use voice chat. The mod runs on Java only.

## Turn it off

Use the same switch: turn it off and save. We disable the mod, leave it in place and close the voice port. Turning it back on starts it again with no new download.
