## The Players page

The **Players** page of your server panel shows everyone who has joined your server in one table: who is online now, when the rest were last seen, and each player's playtime and sessions. The **Lists** column shows whether a player is on the whitelist or banned.

@[open](panel:players)

- Search for any player by name, show only who is **Online**, or show who is on one list.
- Each player's row gives you everything you can do with that player.

> [!note] The whitelist and banned players show up once the server is running, because we read them from the server itself.

## Make yourself an admin

An admin (operator) is a player who can use admin commands in game, such as `/gamemode` and `/tp`. The first thing to do once you join your server is make yourself one:

1. Start the server and join it from Minecraft.
2. Open the **Players** page. You're listed as online.
3. Pick **Make operator** on your row and confirm.

Or type the command in the console with your in-game name, without the `/`:

```txt
op PlayerName
```

The admin list is saved in `ops.json`, which the **Files** tab labels "Admins". To take admin away from a player, type this in the console:

```txt
deop PlayerName
```

> [!warning] An admin can change game modes, teleport anywhere, ban players and edit the world with commands. Only make someone an admin if you trust them.

## The whitelist

When the whitelist is on, only the players on it can join your server. Add your friends first, then turn it on.

### Add your friends

While the server is running, press **Add a player** above the table and type your friend's name. They then show up in the table, even before they join. To add a player who has joined before, pick **Add to Whitelist** on their row, and to take them off, pick **Remove from Whitelist**.

- **A Java player**: type their name exactly as it is in game.
- **A Bedrock player** through crossplay: type their gamertag with a dot in front and its spaces kept, such as `.Gamer Tag`, and we convert it. The details are in the [crossplay guide](/games/minecraft-java/guides/crossplay).

Instead of collecting names yourself, send your friends an invite link so each of them adds themselves to the list. See [Invite your friends](/guides/access).

### Turn it on

In the **Settings** tab, turn on **Whitelist**, then press **Apply and restart**.

@[open](panel:settings)

Or turn it on right away from the console, with no restart:

@[command](whitelist on)

> [!warning] The moment the whitelist is on, every player who isn't on it is locked out, including you if you forgot to add your own name.

## Kick and ban

From a player's row:

- **Kick**: removes an online player right away, and they can join again straight after.
- **Ban**: keeps the player out until you unban them, and removes them if they're online. Ban also works on an offline player who has joined your server before.

Every banned player carries the **Banned players** badge in the **Lists** column. Pick **Unban** on their row and they can join again right away.

To ban a player who has never joined your server, type the command in the console:

```txt
ban PlayerName
```

## More tools for an online player

- **Change game mode**: Survival, Creative, Adventure or Spectator, for that player only.
- **Give XP**: adds a number of levels to their experience.
- **Kill**: the player dies in game and respawns, dropping whatever they carried.

Everything you do from this page shows up in **Activity** with the player's name, so you know who changed what and when.
