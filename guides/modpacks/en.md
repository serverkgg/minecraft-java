## What a modpack is

A modpack is a ready-made set of mods with their configs, put together by one author and published as a single file. Instead of installing twenty mods and tuning them yourself, you pick a modpack and we build your server around it.

We pull modpacks from **Modrinth** and **CurseForge**, and only show the ones that run on a server. Switch between the two sources above the search box.

> [!warning] Every player needs the same modpack installed in their own launcher to join. Your server cannot hand the mods out to players.

## Install one

In the **Modpacks** tab search for the one you want and press install.

@[open](panel:modpacks)

We take a backup first, then:

1. We switch your server type and version to what the pack needs — a Fabric pack makes your server Fabric
2. We remove only the files the previous pack put there, and leave everything you added alone
3. We download every mod in the pack and lay its configs down in their place
4. We start your server again

> [!note] The one exception is an old pack from before we started recording what a pack installs: for that one install we wipe the `mods`, `config`, `defaultconfigs`, `kubejs` and `scripts` folders so nothing is left mixed up.

> [!warning] Your world stays unless the pack needs an older version than yours — then a fresh one starts — and if the pack moves you off a mod loader, everything your mods added to the world is lost. The backup we just took has all of it.

The install takes one to ten minutes depending on the pack's size. You can watch every step on screen.

## The mods that cannot run on a server

Plenty of modpacks ship mods that only work in the player's own game — shaders, minimaps, rendering tweaks, menus. Those do nothing on a server, and some of them stop it from starting at all.

We leave them out during the install: we ask Modrinth, mod by mod, whether it runs on a server, and back that with our own list of names known to be player-only. Anything another kept mod depends on is protected, so we never break a working mod on the way. Shaderpacks and resourcepacks never reach your server in the first place.

> [!note] This is a mitigation, not a guarantee. If a mod we did not know about takes the server down, we read its name out of the crash and show it under **Diagnosis** with one button to switch it off and restart.

## CurseForge

Some CurseForge mod authors block downloads outside their own site. When a pack carries one of those, we look for it elsewhere: first on Modrinth, then inside the server packs the pack's own author publishes on CurseForge, because those files ship those mods on purpose. Find it in either place and the install carries on without you.

If neither has it, we do not install the pack half-finished and we do not start your server on a missing mod. The install finishes, your server waits, and a **Files needed** page opens on your server listing every file we still need. Each one carries a link to its page on CurseForge and an upload box right beside it. Download the file in your browser, drop it in, and we check it is the exact one the pack asks for. Once every file is in place your server starts.

## After the install

The modpack becomes your server's identity: it decides the server type, the Minecraft version and the loader build. The **Version** tab shows the pack at the top — its logo, the release you are on, the Minecraft version and loader, how many mods it laid down, how much space they take, when it was installed and who made it, with a link to its page. **Update** and **Remove** live right there, and a button takes you to the Modpacks tab to browse for another one.

The type and version switcher stays below it. Applying any change there removes the pack in the same step — the warning above the switcher says so before you touch anything.

Mods still install on top from the **Mods** tab, and they run on the pack's own loader.

Your server address does not change:

@[field](server.address)

## Update it

When the pack publishes a new release, an **Update available** badge appears on the Version tab and an **outdated** badge next to its name in the Modpacks tab. Press update in either place and we run the same steps with the new release — with a backup first.

> [!note] Your world stays where it is as long as the new release is on the same server type and the same version or newer.

## Remove it

Press **Remove** on the Version tab, or the delete icon in the Modpacks tab. We take a backup first, then remove the pack, the mods and configs we put there, and the world with them. Anything you installed yourself stays. Your server goes back to plain, on the same type and version, with a fresh world.

> [!warning] A world generated on a modpack cannot open without the pack's mods — the server crashes instead of starting. That is why we start you on a fresh world. If you want the old one, download it from the **Worlds** tab before you remove the pack, or restore the backup.

Changing your server type or version while a pack is applied removes it the same way: the pack, its mods and the world go, and your server comes back on the type and version you picked.

When that happens — or when an install never finished — the pack keeps showing on the Version tab with a **Not installed yet** badge, and in the Modpacks tab with an **outdated** badge, so you know your server is not on it. Press **Remove** to clear it for good.

## Limits

- The modpack file itself must be under **256MB**
- Each file inside the pack must be under **512MB**
- The pack must list fewer than **1024** files

Most modpacks are far smaller than that. If a pack goes over a limit you get a clear reason and your server is left as it was.

## Modpacks and crossplay

Crossplay works with modpacks on Fabric and NeoForge. We reinstall Geyser and Floodgate on the first start after a modpack install, so there is no need to turn crossplay off and on again.

> [!note] Modpacks eat more memory than a plain server. Most want **4GB or more**, and some want much more — read the pack's page on Modrinth before you install it.
