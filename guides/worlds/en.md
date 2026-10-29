Switch, upload, create, copy, download, reset and delete the worlds on your server, all from the **Worlds** tab.

## Before you start {#before-you-start}

The **Worlds** tab lists every world on your server, its size, and which one is active right now. Each world's own actions sit in the menu (⋯) at the end of its row.

@[open](panel:worlds)

The active world is the one your server opens on start, and its name lives in `server.properties` under `level-name`. Switching worlds writes the new name there, and the world only opens after you restart the server.

## Switch world {#switch}

1. Open the menu (⋯) on the world's row and choose **Activate**.
2. Confirm. The ✓ in the **Active** column moves to that world.
3. Restart a running server to open the new world.

![The menu on a world's row in the Worlds tab, with Activate in it.](guides/worlds/activate.webp)

The old world stays exactly where it is, and you can go back to it the same way whenever you want.

## Upload a world from your computer {#upload}

A world is a zip with a folder inside it that holds `level.dat`. Upload accepts Java worlds only. Native Bedrock worlds belong on a native Bedrock server.

1. Press **Upload world** and pick the zip.
2. Keep the page open until the progress bar finishes. We upload the file, unpack it, and add the world for you.
3. Activate the new world, then restart the server if it's running.

![The Upload world button above the worlds table.](guides/worlds/upload-world.webp)

The world takes its name from the folder inside the zip, and you never have to rename anything before you upload. If a world already uses that name, we add a number, so a second `world` arrives as `world-2` and a third as `world-3`, and its Nether and End folders follow the same name. A folder named without Latin letters or digits becomes `world`. A zip holding several worlds imports all of them in one go. Whichever name a world lands on, we tell you right after the upload.

> [!note] If the world comes from a Minecraft version older than your server, Minecraft upgrades it the moment it opens it, and there is no way back. Take a backup first.

## Moving from Aternos {#aternos}

Your world downloads from the Aternos Worlds page at `aternos.org/worlds`: select the world, press **Download**, and a zip of that world lands on your computer. Upload that zip here exactly as it came down, without unzipping or renaming anything.

1. Download the world from the Aternos Worlds page.
2. Press **Upload world** here and pick the zip you downloaded.
3. Activate the imported world, then restart the server.

Your server already has a world named `world`, so an Aternos `world` lands beside it as `world-2`. Nothing is overwritten, and you pick which one is active.

> [!note] On Paper, Purpur and every other Bukkit-based type, Aternos keeps the Nether and the End as separate worlds called `world_nether` and `world_the_end`, and each one has its own Download button. Either upload the overworld alone and let both dimensions generate fresh, or download all three and zip the three folders together so they come across with the world as `world-2_nether` and `world-2_the_end`.

## Create a world {#create}

1. Press **Create world** at the top of the tab, then confirm.
2. Type a **World name**, and a seed in **Seed (optional)** if you want one, then press **Run**.

![The Create world form with a world name typed in.](guides/worlds/create-world.webp)

The new world becomes active and generates at the next start, and your previous world stays available.

## Copy a world {#copy}

1. Open the menu (⋯) on the world's row, choose **Copy world**, then confirm.
2. Type the **New world name**, then press **Run**.

![The Copy world form with the new name typed in.](guides/worlds/copy-world.webp)

We copy that world and all its dimensions under the new name without activating it.

## Turn on hardcore for a world {#hardcore}

In hardcore, each player has one life, and a player who dies becomes a spectator. The difficulty becomes Hard and stays locked while hardcore is on. On Java, hardcore is saved inside the world itself, so the **Hardcore** field in **Settings** only applies to worlds created after you turn it on. For a world you already have, set it here.

1. Stop your server.
2. Open **Worlds**, choose **Set hardcore** in the world's menu (⋯) and confirm, then turn the switch on or off and press **Run**.
3. Start your server.

A ✓ in the **Hardcore** column marks each world that has it on. You can turn it off again from the same place at any time, and the server goes back to the difficulty in **Settings** the next time it starts.

## Download a world to your computer {#download}

1. Open the menu (⋯) on the world's row, choose **Prepare download**, then confirm. Stop the server first if you want a clean copy, because a running world writes its files at any moment.
2. When it finishes, choose **Download** in the same menu.

![The Prepare download confirmation, with its Prepare download button marked.](guides/worlds/prepare-download.webp)

The zip includes the overworld and all existing Nether and End folders, including the sibling folders used by older Paper and Purpur versions.

The export stays in `.serverk-exports` until you replace it or delete it from Files. Prepare it again when you want a fresh copy. Exports are excluded from backups.

## Reset world {#reset}

**Reset world** starts the active world over with the same seed. We move the world with its Nether and End to a new name ending in `-old`, write its seed to `level-seed` in `server.properties`, and the next start generates the world again under its own name. Builds, inventories, advancements and stats start over.

1. Open **Worlds** and press **Reset world** at the top. It resets the active world, so if you want to reset another world, activate it first.
2. Confirm. We stop the server, move the world, and start the server again if it was running.

![The Reset world confirmation, with its Reset world button marked.](guides/worlds/reset-world.webp)

The old world stays in the list under its name with `-old` added, such as `world-old`, or `world-old-2` if that name is taken. Activate it to go back, or delete it once you're sure, because it still uses your disk and goes into every backup.

> [!note] Hardcore is saved inside the world, so the new world follows the **Hardcore** field in **Settings**. If the old world had hardcore on, set it again with **Set hardcore** after the first start.

> [!note] The new world generates with the current generation settings in **Settings**, such as the world type and structures, not with the old world's own. An uploaded world of another type, such as flat, comes back different. Data packs inside the world folder move with the old world.

## Reset from a copy {#reset-from-copy}

**Reset from a copy** puts the active world back to a copy you keep in the list, builds included. Use it for a map someone built on, such as a lobby or a spawn, where a reset from the seed brings back bare terrain without the builds.

1. Upload the map, use **Copy world** on its row to keep an untouched copy such as `lobby-original`, then activate the map itself, not the copy.
2. Whenever you want to start over, press **Reset from a copy** at the top of **Worlds**, then confirm.
3. Type the copy's name in **Source world** exactly as the list shows it, then press **Run**. We stop the server, copy the world you named in place of the active world, and start the server again if it was running.

![The Reset from a copy form with the copy's name typed in.](guides/worlds/reset-from-copy.webp)

The copy must stay in the list as it is, so don't activate it or play on it. It takes the disk space of a second world and goes into every backup. The old active world stays in the list as `-old`, the same as with **Reset world**. If the copy fails, for example when your disk is full, the active world stays as it was.

## Reset the Nether or the End {#reset-dimension}

**Reset the Nether** and **Reset the End** delete that dimension completely, and it generates again the next time someone enters it. Use it when every resource has been looted, or when you want a new dragon.

1. Open the menu (⋯) on the world's row and choose **Reset the Nether** or **Reset the End**.
2. Tick **I understand this can't be undone**, then confirm.

![The Reset the Nether confirmation with its acknowledgement box.](guides/worlds/reset-nether.webp)

> [!danger] Everything you built in the dimension you reset is gone for good. Portals in the overworld stay where they are, but what's on the other side changes.

## Delete a world {#delete}

**Delete** deletes the world with its Nether and End for good. You can't delete the active world, so activate another one first.

1. Open the menu (⋯) on the world's row and choose **Delete**.
2. Tick **I understand this can't be undone**, then press **Delete**.

![The Delete confirmation with its acknowledgement box.](guides/worlds/delete-world.webp)

Both world resets keep the old world as `-old`, but a delete or a Nether or End reset can't be undone, and we don't take a backup before either. Take a backup first, and restore it to bring the world back:

@[open](backups)

Every world on your server goes into the backup, so if you keep 5 old worlds you don't use, your backups grow and take longer. Delete what you don't need, or download it first and then delete it here.

## The Nether or the End is missing after an upload {#missing-dimensions}

> [!warning] Before Minecraft 26.1, a Paper or Purpur world keeps its Nether and End in sibling folders ending in `_nether` and `_the_end`, while a Vanilla, Fabric or Forge world keeps them inside itself. From 26.1 on, every type keeps them inside the world. A world you upload in the other layout won't show its dimensions until the folders are rearranged. When you change the server type from the Version tab, we move them for you.

## Next {#next}

- Take a backup before any reset or delete: the [backups guide](/guides/backups).
- Change your server type or version and see what happens to each world: the [server type and version guide](/games/minecraft-java/guides/server-type).
