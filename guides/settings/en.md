## The Settings tab

The game's own settings sit in clear fields, and we write them into `server.properties` in the right format for you, so you never need to open the file.

@[open](panel:settings)

Change what you want, then pick:

- **Apply**: the values are saved and apply at the next restart.
- **Apply and restart**: the values are saved and we restart your server right away, so they apply now.

## The fields

- **MOTD** (`motd`): the text players see under your server's name in the server list, up to 59 characters.
- **Max players** (`max-players`): 1 to 200. Raising it doesn't add RAM, so pick a number that fits your plan.
- **Game mode** (`gamemode`): Survival, Creative, Adventure or Spectator. It applies to players joining for the first time; see the next section.
- **Difficulty** (`difficulty`): Peaceful, Easy, Normal or Hard.
- **PvP** (`pvp`): when it's off, players can't hurt each other.
- **Online mode** (`online-mode`): checks that every player joins with a genuine Minecraft account.
- **Whitelist** (`white-list`): when it's on, only players you add can join.
- **View distance** (`view-distance`): 3 to 32. The higher it is, the farther players see, and the more CPU and RAM it costs.
- **Simulation distance** (`simulation-distance`): 3 to 32. It's how far from each player mobs move and crops grow.
- **Spawn protection** (`spawn-protection`): 0 to 256. It's the number of blocks around spawn where only admins can break or build. Set it to 0 to turn the protection off.
- **World seed** (`level-seed`): leave it empty for a random world. Changing it doesn't touch an existing world. Only a new world uses it.
- **Allow flight** (`allow-flight`): it doesn't give anyone flight. It stops the server from kicking players who fly in Survival with a mod or a plugin. Turn it on if something on your server gives flight.
- **Command blocks** (`enable-command-block`): lets command blocks run in your world.

> [!warning] From version 1.21.9 on, Minecraft no longer reads `pvp` and `enable-command-block` from `server.properties`: they became game rules (`gamerule`) saved in the world. If your server is on one of these versions, change them with a console command while the server is running.

```txt
gamerule pvp false
gamerule command_blocks_work true
```

On 1.21.9 and 1.21.10, the command block rule is called `commandBlocksEnabled` instead of `command_blocks_work`.

> [!warning] Turning **Online mode** off lets cracked clients join under any name, yours and your admins' included. Keep it on, and if you want Bedrock players in, turn on crossplay instead.

## Game mode for existing players

The **Game mode** field in Settings is the default for players joining for the first time. It doesn't change players who joined before. To change one player's mode while they're online, open the **Players** tab and press **Change game mode** on their row.

@[open](panel:players)

Or type the command in the console, without the `/`:

```txt
gamemode creative PlayerName
```

## Instant changes from the Gameplay tab

The **Gameplay** tab has buttons that run right away on your running server, with nothing to apply and no restart:

- **World controls**: set day or night, clear weather, rain or thunder, save the world, and change the difficulty.
- **Broadcast**: a chat message, or a message on screen, for everyone who is on the server right now.

@[open](panel:gameplay)

> [!note] What you change from the Gameplay tab falls back to the server's settings after a restart. To keep a new difficulty for good, change it in the Settings tab.

## Other settings in the file

`server.properties` has more settings than the tab shows. Open it from the **Files** tab, change the line you want and save, then restart your server.

@[open](files:server.properties)

> [!warning] Don't change `server-port` in the file. Your server address is wired to the default port inside the server, and changing it stops players from joining. To turn on RCON, use its section in the Settings tab rather than the file; the details are in the [remote access guide](/guides/rcon).
