## Plugins or mods?

Your server type decides what it can run:

- **Paper** and **Purpur** run **plugins**, which you find in the **Plugins** tab. A plugin runs on the server alone, and your friends join with plain Minecraft without installing anything.
- **Fabric**, **Forge** and **NeoForge** run **mods**, which you find in the **Mods** tab. Mods that add blocks, items or creatures must be installed by every player too, at the same version, before they can join.
- **Vanilla** runs neither plugins nor mods, so neither tab shows up.

If your server is on Vanilla, or you want to move between plugins and mods, change the type from the **Version** tab. Read the [server type and version guide](/games/minecraft-java/guides/server-type) first so you know what stays in your world and what goes.

@[open](panel:version)

> [!note] Want a ready set of mods that work together? Install a whole modpack in one click from the **Modpacks** tab. The details are in the [modpacks guide](/games/minecraft-java/guides/modpacks).

## Install from the catalog

The **Plugins** and **Mods** tabs each have a catalog you search right there, from Modrinth and CurseForge, plus Hangar for plugins:

1. Pick the source at the top, search by name, or browse the categories and sort the results.
2. Press **Install** on what you want.
3. Pick the **Version to install**. We only list versions that match your server type and version.
4. Confirm, then restart your server so what you installed loads.

We install everything it depends on along with it, and **Activity** says how many dependencies came with it. If it conflicts with something you already have, we refuse the install and name the conflicting one so you can remove it first.

> [!warning] Nothing changes until the restart. Install everything you want, then restart once at the end.

## Manage what you installed

The catalog lists what you installed, and from there you can:

- **Update**: installs the newest version that fits your server. You can update everything in one go.
- **Disable** and **Enable**: turn a plugin or mod off without deleting it, to find out whether it's causing a problem, and turn it back on whenever you like.
- **Remove**: deletes the file from your server.

All of these apply after a restart too.

## Geyser and ViaVersion don't install from here

The crossplay plugins (`Geyser` and `Floodgate`) and the version compatibility plugins (`ViaVersion` and `ViaBackwards`) don't appear in the catalog, because we install and update them for you from one switch in the **Settings** tab. The details are in the [crossplay guide](/games/minecraft-java/guides/crossplay) and the [version compatibility guide](/games/minecraft-java/guides/version-compat).

## A file from your computer

If you have a `jar` file that isn't in the catalog, upload it from the **Files** tab into the `plugins` folder for a plugin, or the `mods` folder for a mod, then restart. It then shows up in your installed list like the rest.

@[open](files)

> [!note] Only download files from their official source, and make sure they're made for your server type and version. A Paper plugin doesn't run on Fabric, and a Forge mod doesn't run on NeoForge.

## The server crashed after an install?

A mod or plugin that doesn't fit your version is the most common reason for a crash after an install. The **Overview** page shows you the cause, and the mod's name when we know it, such as a missing mod, a mod installed twice, or a mod that needs a newer Java. Turn off the last thing you installed and start the server. The details are in the [crash guide](/guides/crashes).
