## The Worlds tab

The **Worlds** tab lists every world on your server, its size, and which one is active right now.

@[open](panel:worlds)

The active world is the one your server opens on start, and its name lives in `server.properties` under `level-name`. Switching worlds writes the new name there, and the world only opens after you restart the server.

## Switch world

Pick the world in the table and press **Activate**. Restart a running server to open the new world. The old world stays exactly where it is, and you can go back to it the same way whenever you want.

## Upload a world from your computer

A world is a zip with a folder inside it that holds `level.dat`. From the Worlds tab:

1. Press **Upload world** and pick the zip
2. Keep the page open until the progress bar finishes — we upload the file, unpack it, and add the world for you
3. Activate the new world, then restart the server if it is running

The world takes its name from the folder inside the zip, and you never have to rename anything before you upload. If a world already uses that name we add a number, so a second `world` arrives as `world-2` and a third as `world-3`, and its Nether and End folders follow the same name. A folder named without Latin letters or digits becomes `world`. A zip holding several worlds imports all of them in one go. Whichever name a world lands on, we tell you right after the upload.

> [!note] If the world comes from a Minecraft version older than your server, Minecraft upgrades it the moment it opens it, and there is no way back. Take a backup first.

> [!warning] Before Minecraft 26.1 a Paper or Purpur world keeps its Nether and End in sibling folders ending in `_nether` and `_the_end`, while a Vanilla, Fabric or Forge world keeps them inside itself; from 26.1 on every type keeps them inside the world. A world you upload in the other layout will not show its dimensions until the folders are rearranged. When you change the server type from the Version tab we move them for you.

## Moving from Aternos

Your world downloads from the Aternos Worlds page at `aternos.org/worlds`: select the world, press **Download**, and a zip of that world lands on your computer. Upload that zip here exactly as it came down — no unzipping, no renaming.

1. Download the world from the Aternos Worlds page
2. Press **Upload world** here and pick the zip you downloaded
3. Activate the imported world, then restart the server

Your server already has a world named `world`, so an Aternos `world` lands beside it as `world-2`. Nothing is overwritten, and you pick which one is active.

> [!note] On Paper, Purpur and every other Bukkit-based type, Aternos keeps the Nether and the End as separate worlds called `world_nether` and `world_the_end`, and each one has its own Download button. Either upload the overworld alone and let both dimensions generate fresh, or download all three and zip the three folders together so they come across with the world as `world-2_nether` and `world-2_the_end`.

## Create or clone a world

Use **Create world** to choose a name and optional seed. The new world becomes active and generates at the next start; your previous world stays available. Use **Clone world** on a row to copy that world and all its dimensions under a new name without activating it.

## Download a world to your computer

Select **Prepare download** on the world's row, then **Download** after it finishes. Stop the server first if you want a clean copy, because a running world writes its files at any moment. The ZIP includes the overworld and all existing Nether and End folders, including the sibling folders used by older Paper/Purpur versions.

The export stays in `.serverk-exports` until replaced or removed from Files. Prepare it again when you want a fresh copy. Exports are excluded from backups. Import accepts Java worlds only; native Bedrock worlds belong on a native Bedrock server.

## Reset the Nether or the End

**Reset the Nether** and **Reset the End** wipe that dimension completely, and it generates again the next time somebody walks in. Handy when everything has been looted, or when you want a fresh dragon.

> [!danger] Everything you built in the dimension you reset is gone forever. Portals in the overworld stay where they are, but what is on the other side changes.

## Delete a world

**Delete** removes the world with its Nether and its End forever. We will not let you delete the active world — activate another one first.

Destructive world actions require a recovery backup before they proceed. Restore that backup to undo a deletion or dimension reset:

@[open](backups)

## Worlds and backups

Every world on your server goes into the backup. Leave five old worlds parked and your backups grow, take longer, and eat into your disk. Delete what you do not need, or download it first and then delete it here.
