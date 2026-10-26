## What causes lag on small plans {#lag}

A Minecraft server updates the world 20 times a second, and each update, called a tick, gets 50 ms at most. In every tick, mobs move, crops grow, redstone runs, and the new land players reach is generated. When a tick needs more than 50 ms, the server falls behind the game and players see lag: blocks that come back after they break them, and mobs that freeze in place.

All of this work runs on the CPU, and each plan has a fixed CPU limit in vCPU, shown on its card. More RAM doesn't make a tick faster, so on small plans lag usually comes from the CPU, not the RAM.

Two signs the CPU isn't enough:

- The console prints the line `Can't keep up! Is the server overloaded?`.
- The **Diagnosis** section of the **Analytics** tab shows "Your server is lagging" or "CPU is maxed out".

## View and simulation distance {#distances}

Two fields in the **Settings** tab decide most of the CPU load:

- **View distance** (`view-distance`): the land the server loads and sends around every player.
- **Simulation distance** (`simulation-distance`): the land around every player where mobs move and crops grow.

The land grows with the square of the distance, so raising a distance from 8 to 10 adds more than half again around every player, and that repeats for every player in a different part of the world.

Every server starts with view distance 10 and simulation distance 10, the game's own values. If you see lag, lower **Simulation distance** first, then **View distance**, and press **Apply and restart**. On a plan with 1 vCPU, view distance 8 and simulation distance 6 are a good start.

@[open](panel:settings)

## Pre-generate the world with Chunky {#pregenerate}

Generating new land is the heaviest thing a server does. When players explore land nobody has reached yet, the server generates it while they play, and that causes lag. The fix is to generate the world once ahead of time, at an hour when few people play, then set a world border that keeps players inside the generated land.

1. Install **Chunky** from the **Plugins** tab on Paper and Purpur, or from the **Mods** tab on Fabric, Forge and NeoForge, then restart your server.
2. Type these commands in the console, in order, without the `/`:

```txt
worldborder center 0 0
worldborder set 4000
chunky worldborder
chunky start
```

The first two commands set a world border as a square 4000 blocks wide around the middle of the world, `chunky worldborder` takes that border, and `chunky start` starts generating. The console shows the progress. Pause it with `chunky pause` and pick it up again with `chunky continue`. If the server stops before generating finishes, type `chunky continue` after it starts.

> [!note] Generating uses all of the CPU until it finishes, so start it when nobody is on the server. The larger the border, the longer it takes and the more disk space the world takes.

Vanilla runs neither plugins nor mods, so change the type from the **Version** tab if you want Chunky. The details are in the [server type and version guide](/games/minecraft-java/guides/server-type).

## World generation mods such as Distant Horizons {#worldgen-mods}

Mods that change how land looks make every new piece of land heavier to generate, so pre-generate the world with Chunky before players start exploring.

**Distant Horizons** on the server generates far terrain in the background and can use a full vCPU, which alone is enough to make a small plan lag. That's why we show this warning under it in your installed mods. The mod works in each player's own game without a copy on the server, so if you see lag, press **Disable** on it in the **Mods** tab and restart your server.

## Read the tick time {#tick-time}

On version 1.20.3 and later, run this command in the console:

@[command](tick query)

The result shows the average tick time in ms. While the average stays under 50 ms, the server keeps up with the game. Above that, the server falls behind and players see lag. Run it while players are online, then again after each change to compare.

## A daily restart for servers with mods {#daily-restart}

On a server with mods, RAM use and load build up the longer it runs, and a daily restart keeps it light. Add a daily restart at a quiet hour from the **Schedules** tab, and warn players first with a `say` command as the first step. The steps are in the [scheduled tasks guide](/guides/schedules).

> [!note] If the CPU stays maxed out after all of these steps, move to a plan with more vCPU.
