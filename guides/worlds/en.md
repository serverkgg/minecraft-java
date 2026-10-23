## The Worlds tab

The **Worlds** tab lists every world on your server, its size, and which one is active right now.

@[open](panel:worlds)

The active world is the one your server opens on start, and its name lives in `server.properties` under `level-name`. Switching worlds writes the new name there, and the world only opens after you restart the server.

## Switch world

Pick the world in the table and press **Activate**. Restart a running server to open the new world. The old world stays exactly where it is, and you can go back to it the same way whenever you want.

## Upload a world from your computer

A world is a zip with a folder inside it that holds `level.dat`. From the Worlds tab:

1. Press **Upload world** and pick the zip
2. Keep the page open until the progress bar finishes. We upload the file, unpack it, and add the world for you
3. Activate the new world, then restart the server if it's running

The world takes its name from the folder inside the zip, and you never have to rename anything before you upload. If a world already uses that name, we add a number, so a second `world` arrives as `world-2` and a third as `world-3`, and its Nether and End folders follow the same name. A folder named without Latin letters or digits becomes `world`. A zip holding several worlds imports all of them in one go. Whichever name a world lands on, we tell you right after the upload.

> [!note] If the world comes from a Minecraft version older than your server, Minecraft upgrades it the moment it opens it, and there is no way back. Take a backup first.

> [!warning] Before Minecraft 26.1, a Paper or Purpur world keeps its Nether and End in sibling folders ending in `_nether` and `_the_end`, while a Vanilla, Fabric or Forge world keeps them inside itself. From 26.1 on, every type keeps them inside the world. A world you upload in the other layout won't show its dimensions until the folders are rearranged. When you change the server type from the Version tab, we move them for you.

## Moving from Aternos

Your world downloads from the Aternos Worlds page at `aternos.org/worlds`: select the world, press **Download**, and a zip of that world lands on your computer. Upload that zip here exactly as it came down, without unzipping or renaming anything.

1. Download the world from the Aternos Worlds page
2. Press **Upload world** here and pick the zip you downloaded
3. Activate the imported world, then restart the server

Your server already has a world named `world`, so an Aternos `world` lands beside it as `world-2`. Nothing is overwritten, and you pick which one is active.

> [!note] On Paper, Purpur and every other Bukkit-based type, Aternos keeps the Nether and the End as separate worlds called `world_nether` and `world_the_end`, and each one has its own Download button. Either upload the overworld alone and let both dimensions generate fresh, or download all three and zip the three folders together so they come across with the world as `world-2_nether` and `world-2_the_end`.

## Create or copy a world

Use **Create world** to choose a name and optional seed. The new world becomes active and generates at the next start, and your previous world stays available. Use **Copy world** on a row to copy that world and all its dimensions under a new name without activating it.

## Turn on hardcore for a world

In hardcore, each player has one life, and a player who dies becomes a spectator. The difficulty becomes Hard and stays locked while hardcore is on. On Java, hardcore is saved inside the world itself, so the **Hardcore** field in **Settings** only applies to worlds created after you turn it on. For a world you already have, set it here.

1. Stop your server.
2. Open **Worlds**, choose **Set hardcore** on the world, then turn the switch on or off.
3. Start your server.

A ✓ in the **Hardcore** column marks each world that has it on. You can turn it off again from the same place at any time, and the server goes back to the difficulty in **Settings** the next time it starts.

## Download a world to your computer

Select **Prepare download** on the world's row, then **Download** after it finishes. Stop the server first if you want a clean copy, because a running world writes its files at any moment. The ZIP includes the overworld and all existing Nether and End folders, including the sibling folders used by older Paper and Purpur versions.

The export stays in `.serverk-exports` until you replace it or delete it from Files. Prepare it again when you want a fresh copy. Exports are excluded from backups. Upload accepts Java worlds only. Native Bedrock worlds belong on a native Bedrock server.

## Reset world

**Reset world** starts the active world over with the same seed. We move the world with its Nether and End to a new name ending in `-old`, write its seed to `level-seed` in `server.properties`, and the next start generates the world again under its own name. Builds, inventories, advancements and stats start over.

1. Open **Worlds** and press **Reset world** at the top. It resets the active world, so activate another world first if that's the one you want to reset.
2. Confirm. We stop the server, move the world, and start the server again if it was running.

The old world stays in the list under its name with `-old` added, such as `world-old`, or `world-old-2` if that name is taken. Activate it to go back, or delete it once you're sure, because it still uses your disk and goes into every backup.

> [!note] Hardcore is saved inside the world, so the new world follows the **Hardcore** field in **Settings**. If the old world had hardcore on, set it again with **Set hardcore** after the first start.

> [!note] The new world generates with the current generation settings in **Settings**, such as the world type and structures, not with the old world's own. An uploaded world of another type, such as flat, comes back different. Data packs inside the world folder move with the old world.

## Reset from a copy

**Reset from a copy** puts the active world back to a copy you keep in the list, builds included. Use it for a map someone built on, such as a lobby or a spawn, where a reset from the seed brings back bare terrain without the builds.

1. Upload the map, use **Copy world** on its row to keep an untouched copy such as `lobby-original`, then activate the map itself, not the copy.
2. Whenever you want to start over, press **Reset from a copy** at the top of **Worlds** and type the copy's name exactly as the list shows it.
3. Confirm. We stop the server, copy the world you named in place of the active world, and start the server again if it was running.

The copy must stay in the list as it is, so don't activate it or play on it. It takes the disk space of a second world and goes into every backup. The old active world stays in the list as `-old`, the same as with **Reset world**. If the copy fails, for example when your disk is full, the active world stays as it was.

## Reset the Nether or the End

**Reset the Nether** and **Reset the End** delete that dimension completely, and it generates again the next time someone enters it. Handy when everything has been looted, or when you want a fresh dragon.

> [!danger] Everything you built in the dimension you reset is gone for good. Portals in the overworld stay where they are, but what's on the other side changes.

## Delete a world

**Delete** deletes the world with its Nether and End for good. You can't delete the active world, so activate another one first.

Both world resets keep the old world as `-old`, but a delete or a Nether or End reset can't be undone, and we don't take a backup before either. Take a backup first, and restore it to bring the world back:

@[open](backups)

## Worlds and backups

Every world on your server goes into the backup. Leave five old worlds parked and your backups grow, take longer, and use up your disk. Delete what you don't need, or download it first and then delete it here.
