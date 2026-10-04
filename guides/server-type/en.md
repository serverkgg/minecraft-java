## The server types

Your server runs one of six types, and every one of them writes the same world:

- **Vanilla**: Minecraft as Mojang ships it, no plugins and no mods
- **Paper** and **Purpur**: they run plugins. Purpur is Paper with extra options, and switching between the two touches nothing
- **Fabric**, **Forge** and **NeoForge**: mod loaders. They run mods, and every player needs the same mods installed to join

Only two things really differ between them: where your world's Nether and End are stored, and whether your world holds things a mod added.

@[open](panel:version)

## We tell you what happens before you save

The moment you pick a type or a version and press save, we work the change out and show it to you line by line: whether your world stays or goes, what happens to your plugins and mods, and whether we need to move files. Nothing changes until you agree, and we take a backup first:

@[open](backups)

## Changing the type

Your world stays in place on every switch between types. What changes:

- **Between Paper and Purpur**: nothing is lost, the same plugins and the same configs keep running
- **From Paper or Purpur to any other type**: your world stays, and we move its Nether and End into their new place so they carry over. Your plugins and their configs are removed because they don't run there
- **To Paper or Purpur from any type**: nothing needs moving, Paper rearranges your world itself the first time it opens it
- **Leaving a mod loader** (Fabric, Forge or NeoForge to any other type, Forge to NeoForge included): your world stays, but everything the mods added to it (blocks, items, creatures and dimensions) is lost the moment the new server opens it

> [!warning] If your world uses a dimension that came from a mod, the new server may refuse to start once that mod is gone. The backup is the way back.

> [!note] Plugins and mods don't travel between the families: a Paper plugin doesn't run on Fabric, and a Forge mod doesn't run on NeoForge. That's why we remove their folders instead of leaving them to break your start.

From version 26.1 on, every type stores the Nether and the End inside the world folder itself. Before it, Paper and Purpur kept them in folders beside it. We handle the move in both cases, with nothing for you to do.

## Changing the version

- **A newer version**: your world stays and Minecraft upgrades it the moment it opens it. If your server is on a mod loader, your mods may need an update from the Mods tab
- **An older version**: Minecraft can't open a world that ran on a newer version. We start a fresh server, and your world, plugins, mods and settings go

> [!danger] Moving to an older version can't be undone in game. The only route to your old world is the backup we took before the change.

Leave the **Minecraft version** field empty to stay on the version you're on, and pick one only when you want to change it.

## A modpack makes the decision

When your server runs a modpack, the pack decides the type, the Minecraft version and the loader build, so the Version tab hides the switchers and shows its card instead. Remove the modpack first if you want to choose yourself.

## Features that depend on the type

- **Crossplay** works on Paper, Purpur, Fabric and NeoForge
- **Version compatibility** works on Paper and Purpur

Switch to a type that doesn't support the feature and it disappears from Settings, and the Bedrock address disappears from your server page.
