Install plugins and mods from the catalog with everything they need, keep them up to date, and give your players the mods they need to join.

## Before you start {#before-you-start}

Your server type decides what it can run:

- **Paper** and **Purpur** run **plugins**, which you find in the **Plugins** tab. A plugin runs on the server alone, and your friends join with plain Minecraft without installing anything.
- **Fabric**, **Forge** and **NeoForge** run **mods**, which you find in the **Mods** tab. Mods that add blocks, items or creatures must be installed by every player too, at the same version, before they can join.
- **Vanilla** runs neither plugins nor mods, so neither tab shows up.

If your server is on Vanilla, or you want to move between plugins and mods, change the type from the **Version** tab. Read the [server type and version guide](/games/minecraft-java/guides/server-type) first so you know what stays in your world and what goes.

@[open](panel:version)

> [!note] Want a ready set of mods that work together? Install a whole modpack in one click from the **Modpacks** tab. The details are in the [modpacks guide](/games/minecraft-java/guides/modpacks).

## Install from the catalog {#install}

The **Plugins** and **Mods** tabs each have a catalog you search right there, from Modrinth and CurseForge, plus Hangar for plugins:

1. Pick the source at the top, search by name, or browse the categories and sort the results.
2. Press **Install** on what you want.
3. Pick the **Version to install**. We only list versions that match your server type and version.
4. Press **Install** to confirm, then restart your server so what you installed loads.

![The Plugins catalog with its sources, the search box and a result's Install button.](guides/plugins-mods/catalog-search.webp)

![The install dialog with the version to install and its Install button.](guides/plugins-mods/install-version.webp)

What you installed shows up in your installed list at the top of the catalog. We install everything it depends on along with it, and **Activity** says how many dependencies came with it.

> [!warning] Nothing changes until the restart. Install everything you want, then restart once at the end.

## Manage what you installed {#manage}

The catalog lists what you installed, and from there you can:

- **Update**: installs the newest version that fits your server. You can update everything in one go.
- **Disable** and **Enable**: turn a plugin or mod off without deleting it, to find out whether it's causing a problem, and turn it back on whenever you like.
- **Remove**: deletes the file from your server.

![The installed list with the update button, the on and off switch and the remove button on one plugin.](guides/plugins-mods/installed-list.webp)

All of these apply after a restart too.

## Geyser and ViaVersion don't install from here {#geyser-viaversion}

The crossplay plugins (`Geyser` and `Floodgate`) and the version compatibility plugins (`ViaVersion` and `ViaBackwards`) don't appear in the catalog, because we install and update them for you from one switch in the **Settings** tab. The details are in the [crossplay guide](/games/minecraft-java/guides/crossplay) and the [version compatibility guide](/games/minecraft-java/guides/version-compat).

## A file from your computer {#upload}

If you have a `jar` file that isn't in the catalog:

1. Open the **Files** tab, then the `plugins` folder for a plugin, or the `mods` folder for a mod.
2. Upload the `jar` into that folder.
3. Restart your server.

@[open](files)

![The plugins folder in the Files tab, with the upload button.](guides/plugins-mods/upload-jar.webp)

It then shows up in your installed list like the rest.

> [!note] Only download files from their official source, and make sure they're made for your server type and version. A Paper plugin doesn't run on Fabric, and a Forge mod doesn't run on NeoForge.

## Give players the pack {#client-pack}

Every player needs the same mods as your server. Instead of each player installing them one by one, we build a pack from them that players import into their launcher in one step.

1. Open the **Modpacks** tab and type a name for the pack in **Modpack for players**, below **Your uploads**.
2. Press **Build pack**.
3. Press **Download** on the pack in the list, and send the file to your friends.

@[open](panel:modpacks)

The **Import in** column names the launcher that opens the file:

- When every mod came from CurseForge, we build a `zip` that players import in the CurseForge app: **Import**, then **Choose .zip file**.
- Otherwise we build an `.mrpack` that players import in the Modrinth app or Prism Launcher. In Prism, press **Add Instance**, then **Import**.

The pack holds no mod files, only the list of mods and where each one downloads from, so the player's launcher downloads them from their source. The pack also adds your server to each player's server list, so it's waiting under **Multiplayer** after the import. Whenever you change your mods, build the pack again and send it again. The new one replaces the old one.

### What the pack can't hold

- A `jar` you uploaded yourself instead of installing it from the catalog. We name it after the build, so send it to players yourself.
- In an `.mrpack`, a CurseForge mod whose author allows downloads only from CurseForge. We stop the build and name it. Remove it or replace it with a mod from Modrinth, then build again.
- A mod whose file we can't match with its copy in the catalog. Install it again from the catalog, then build again.
- A server running a modpack from the **Modpacks** tab gets no pack. Send players that same modpack. The details are in the [modpacks guide](/games/minecraft-java/guides/modpacks).

**Delete** removes the file from your server. Copies players already downloaded stay as they are.

## The install was refused {#install-conflict}

If what you install conflicts with something you already have, we refuse the install and name the conflicting one. Remove it first, then install again.

## The server crashed after an install {#crash-after-install}

A mod or plugin that doesn't fit your version is the most common reason for a crash after an install. The **Overview** tab shows you the cause, and the mod's name when we know it, such as a missing mod, a mod installed twice, or a mod that needs a newer Java. Turn off the last thing you installed and start the server. The details are in the [crash guide](/guides/crashes).

## Next {#next}

- Pre-generate your world with Chunky to cut lag: the [performance guide](/games/minecraft-java/guides/performance).
