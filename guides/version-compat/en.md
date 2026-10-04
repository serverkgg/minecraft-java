## What version compatibility does

Your server runs one Minecraft version, and normally a player has to be on exactly that version to get in. Version compatibility drops that requirement: friends join on a Java version newer or older than your server, with nothing to change on their side.

We install `ViaVersion` and `ViaBackwards` for you and keep them updated on every start:

- **ViaVersion** lets players on a version newer than your server in
- **ViaBackwards** lets players on a version older than your server in, and it runs on top of ViaVersion, which is why we install both together

> [!note] Version compatibility works on Paper and Purpur. If your server is Vanilla, Fabric, Forge or NeoForge, switch the type from the Version tab first.

## Turn it on

In the **Settings** tab, turn on **Let other Java versions in** and save. The server restarts right away, and the first start takes a moment while the files download.

@[open](panel:settings)

If a download fails, your server still starts without version compatibility and prints a warning line in the console. We never block a start on a download.

## Your server version doesn't change

Version compatibility doesn't touch your server's version or your world. Your server stays on its own version:

@[field](server.version)

The two plugins only translate between the player's version and the server's version while they connect and play.

## What to expect

The translation isn't perfect, and the further a player's version is from the server's, the more you'll notice:

- Blocks and items added in newer versions look wrong or go missing for players on an older version
- Some newer sounds and mob behaviors never reach older versions
- Plugins that depend on version details can misbehave for a player on a different version

> [!warning] If your server runs a lot of plugins, try it yourself from an older version before you tell your friends to join.

## Fabric isn't covered

On Fabric the project ships under a different name (`ViaFabric`) with its own setup, and we didn't wire it into this switch. If your server is Fabric and you want it, install it yourself from the Mods tab.

## Turn it off

Use the same switch: turn it off and save. We disable both plugins and leave them in place, so turning it back on starts them again with no new download.
