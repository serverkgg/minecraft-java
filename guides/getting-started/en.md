## Create your server

From the **Create a server** page pick Minecraft, then choose a plan — 4GB is a great start for playing with friends, and you can upgrade later without losing your world.

After payment your machine starts provisioning — follow its progress on the order page. There is nothing to set up: as soon as the machine is ready your server downloads the latest Minecraft release and starts on its own.

> [!note] The first start takes a moment while the game downloads and the world generates. Watch all of it from the console tab.

## Join the game

:::when server.address
Copy your address:

@[field](server.address)

Then inside Minecraft:

1. Open **Multiplayer**
2. Click **Add Server**
3. Paste the address into Server Address
4. Join and play

:::else
Your server is still setting up, so it has no address yet — it appears here the moment the install finishes.

@[open](console)
:::

## Make friends with the console

The **Console** tab streams the server log live, and you can type commands directly without the leading `/` — for example:

```txt
say Hello everyone
time set day
gamemode creative Steve
```

> [!warning] Stopping the server with the stop button saves the world safely. Only force-restart if the server is completely stuck.

## What next?

### Change a setting

Every server setting lives in `server.properties`.

@[open](files:server.properties)

### Keep it to your friends

Turn the whitelist on, then add each friend by name from the console with `whitelist add playername`.

And if you banned somebody and want them back, find them under Banned players in the **Players** tab and press Unban.

@[command](whitelist on)

### Your world is safe

We take automatic backups, and you can take one yourself at any time.

@[open](backups)
