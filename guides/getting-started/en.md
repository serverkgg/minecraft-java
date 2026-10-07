## Create your server

From the **Create a server** page, pick Minecraft, then choose a plan. 4GB is a great start for playing with friends, and you can upgrade later without losing your world.

After payment, your server starts setting up. Follow its progress on the order page. There's nothing to set up yourself: as soon as it's ready, your server downloads the latest Minecraft release and starts on its own.

> [!note] The first start takes a moment while the game downloads and the world generates. Watch all of it from the Console tab.

## Join the game

:::when server.address
Copy your address:

@[field](server.address)

Then inside Minecraft:

1. Open **Multiplayer**
2. Click **Add Server**
3. Paste the address into **Server Address**
4. Join and play

:::else
Your server is still setting up, so it has no address yet. The address appears here as soon as the install finishes.

@[open](console)
:::

## The console

The **Console** tab streams the server log live, and you can type commands directly without the leading `/`. For example:

```txt
say Hello everyone
time set day
gamemode creative Steve
```

> [!warning] Stopping the server with the stop button saves the world safely. Only force a restart if the server is completely stuck.

## What next?

### Change a setting

Your server settings sit in clear fields in the **Settings** tab. The details are in the [settings guide](/games/minecraft-java/guides/settings).

@[open](panel:settings)

### Keep it to your friends

Add each friend by name from the **Players** tab, or send your friends an [invite link](/guides/access) so each of them adds themselves, then turn the whitelist on. The details are in the [players guide](/games/minecraft-java/guides/players).

If you banned someone and want them back, find them under Banned players in the **Players** tab and press Unban.

@[command](whitelist on)

### Your world is safe

We take automatic backups, and you can take one yourself at any time.

@[open](backups)
