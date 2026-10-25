## What a modpack is

A modpack is a ready-made set of mods with their configs, put together by one author and published as a single file. Instead of installing twenty mods and tuning them yourself, you pick a modpack and we build your server around it.

We pull modpacks from **Modrinth** and **CurseForge**, and only show the ones that run on a server. For a pack you put together yourself in your launcher, export it and upload it as described in Upload your own pack below. Switch between the sources above the search box.

> [!warning] Every player needs the same modpack installed in their own launcher to join, because your server can't hand the mods out to players. For a catalog pack, send them its page on Modrinth or CurseForge, linked on the **Version** tab. For a pack you uploaded, download its file from **Your uploads** and send it to them to import in their launcher.

For a server with mods but no modpack, build a pack from its mods for players to import in their launcher, in **Modpack for players** on the **Modpacks** tab, below **Your uploads**. The steps are in the [plugins and mods guide](/games/minecraft-java/guides/plugins-mods).

## Install one

In the **Modpacks** tab, search for the one you want and press install.

@[open](panel:modpacks)

We take a backup first, then:

1. We switch your server type and version to what the pack needs, so a Fabric pack makes your server Fabric
2. We remove only the files the previous pack put there, and leave everything you added alone
3. We download every mod in the pack and lay its configs down in their place
4. We start your server again

> [!note] The one exception is an old pack from before we started recording what a pack installs: for that one install, we delete the `mods`, `config`, `defaultconfigs`, `kubejs` and `scripts` folders so nothing is left mixed up.

> [!warning] Your world stays unless the pack needs an older version than yours, in which case a fresh one starts. If the pack moves you off a mod loader, everything your mods added to the world is lost. The backup we just took has all of it.

The install takes one to ten minutes depending on the pack's size. You can watch every step on screen.

## The mods that can't run on a server

Plenty of modpacks ship mods that only work in the player's own game, such as shaders, minimaps, rendering tweaks and menus. Those do nothing on a server, and some of them stop it from starting at all.

We leave them out during the install: we ask Modrinth, mod by mod, whether it runs on a server, and back that with our own list of names known to be player-only. Anything another kept mod depends on is protected, so we never break a working mod on the way. Shaderpacks and resourcepacks never reach your server in the first place.

> [!note] This is a mitigation, not a guarantee. If a mod we didn't know about crashes the server, we read its name out of the crash and show it under **Diagnosis** with one button to switch it off and restart.

## CurseForge

Some CurseForge mod authors block downloads outside their own site. When a pack carries one of those, we look for it elsewhere: first on Modrinth, then inside the server packs the pack's own author publishes on CurseForge, because those files ship those mods on purpose. Find it in either place and the install carries on without you.

If neither has it, we don't install the pack half-finished and we don't start your server on a missing mod. The install finishes, your server waits, and a **Files needed** page opens on your server listing every file we still need. Each one carries a link to its page on CurseForge and an upload box right beside it. Download the file in your browser, drop it in, and we check that it's the exact one the pack asks for. Once every file is in place, your server starts.

## Upload your own pack

First, export the pack from the launcher you built it in:

- In the CurseForge app: on the **Minecraft** tab, pick the pack, open the menu (the three dots) and choose **Share Profile**. Tick **mods** and **config**, then press **Export as .zip**.
- In the Modrinth app: open the pack, and on its **Mods** tab press **Export modpack** to get an `.mrpack` file.

Then upload the file in **Your uploads** at the top of the **Modpacks** tab, with **Upload modpack**.

@[open](panel:modpacks)

We read the file and list it there with its name and release, the Minecraft version and loader it needs, how many files it lists and its size. To install it, pick the **Your uploads** source above the search box below, and press install. It goes through the same steps as a catalog pack: a backup first, then leaving out the mods that can't run on a server, then laying its configs down in their place.

> [!note] A CurseForge ZIP lists its mods without carrying them, so we download them from CurseForge during the install. That's why it installs only while the CurseForge source is available above the search box. If it carries a mod whose author blocks downloads outside CurseForge, the **Files needed** steps in the section above apply.

After the install, the pack shows on the **Version** tab with an **Uploaded by you** badge. We don't check it for updates, so when it gets a new release, export it from your launcher again, upload it, then install it.

**Download** gives you back the file exactly as you uploaded it, and that's the file your players import in their launcher. **Delete** removes the file from your server and changes nothing else. It doesn't delete the pack your server runs right now, so remove that one from the Version tab first.

## After the install

The modpack becomes your server's identity: it decides the server type, the Minecraft version and the loader build. The **Version** tab shows the pack at the top: its logo, the release you're on, the Minecraft version and loader, how many mods it laid down, how much space they take, when it was installed and who made it, with a link to its page. **Update modpack** and **Remove** live right there, and a button takes you to the Modpacks tab to browse for another one.

The type and version switcher stays below it. Applying any change there removes the pack in the same step, and the warning above the switcher says so before you touch anything.

Mods still install on top from the **Mods** tab, and they run on the pack's own loader.

Your server address doesn't change:

@[field](server.address)

## Update it

When the pack publishes a new release, an **Update available** badge appears on the Version tab and an **Outdated** badge next to its name in the Modpacks tab. Press update in either place and we run the same steps with the new release, with a backup first.

> [!note] Your world stays where it is as long as the new release is on the same server type and the same version or newer.

## Remove it

Press **Remove** on the Version tab, or the delete icon in the Modpacks tab. We take a backup first, then remove the pack and the mods and configs we put there. Anything you installed yourself stays. The world you built on the pack is kept under a new name, such as `world-rlcraft-old`, and your server goes back to the same type and version without a modpack, with a fresh world.

> [!warning] A world generated on a modpack can't open without the pack's mods, so the server crashes instead of starting. That's why we start you on a fresh world and keep the old one aside in the **Worlds** tab. Download it from there, or delete it once you no longer need it, since every world goes into your backups.

Changing your server type or version while a pack is applied removes it the same way: the pack and its mods go, the world is kept under a new name, and your server comes back on the type and version you picked.

When that happens, or when an install never finished, the pack keeps showing on the Version tab with a **Not installed yet** badge, and in the Modpacks tab with an **Outdated** badge, so you know your server isn't on it. Press **Remove** to clear it for good.

## Limits

- The modpack file itself must be under **256MB**
- Each file inside the pack must be under **512MB**
- The pack must list fewer than **1024** files

Most modpacks are far smaller than that. If a pack goes over a limit, you get a clear reason and your server is left as it was.

## Modpacks and crossplay

Crossplay works with modpacks on Fabric and NeoForge. We reinstall Geyser and Floodgate on the first start after a modpack install, so there is no need to turn crossplay off and on again.

> [!note] Modpacks use more RAM than a plain server. Most want **4GB or more**, and some want much more. Read the pack's page on Modrinth before you install it.

## Choose the release before installing

Select a modpack release in the catalog and check its Minecraft version and loader in the preview. Available files are downloaded and verified before replacing the previous installation. Restricted CurseForge files still require your upload before the server can start.

The Modpacks tab shows the exact pack release players need on their computers. Ask friends to install the same release before joining. For a pack you uploaded, send them the same file from **Your uploads**.
