Create your Minecraft Java server, watch it start, and get your first player in, all in a few minutes.

## Before you start {#before-you-start}

- Minecraft Java on the computer of everyone who'll play. Friends on phone, console or Windows can join your Java server too once you turn on crossplay. The details are in the [crossplay guide](/games/minecraft-java/guides/crossplay).

## 1. Create your server {#create}

From the [New server](/games/create) page, pick Minecraft Java, then a region and a plan. The plan badged **Best fit** is a good start, and you can move to a bigger plan later without losing your world.

After you pay, we start setting up your server. Follow its progress on the order page. Then the panel opens on the **Setup** page: pick a server type and version if you want plugins or mods, or press **Skip this step** to stay on the latest Minecraft release.

## 2. Watch the first start {#first-start}

The first start takes a moment while the game downloads and the world generates. Watch all of it from the **Console** tab.

@[open](console)

![The Console tab in the panel menu, with the server log streaming beside it.](guides/getting-started/first-start.webp)

Your server is ready when the log prints a line that starts with `Done` and ends with `For help, type "help"`, and the server shows **Running**.

## 3. Join the game {#join}

Your address is at the top of the **Overview** tab, beside a button that copies it.

![The server address on the Overview tab, with its copy button.](guides/getting-started/server-address.webp)

:::when server.address
Copy your address:

@[field](server.address)

Then inside Minecraft:

1. Open **Multiplayer**
2. Click **Add Server**
3. Paste the address into **Server Address**, alone and without a port
4. Join and play

:::else
Your server is still setting up, so it has no address yet. The address appears here as soon as the install finishes.

@[open](console)
:::

## 4. Send a command {#console}

The **Console** tab streams the server log live, and you can type commands directly without the leading `/`. For example:

```txt
say Hello everyone
time set day
gamemode creative Steve
```

![The command box at the bottom of the console, with a command typed in.](guides/getting-started/console-command.webp)

The command and its result show up in the log right away.

> [!note] The stop button sends the `stop` command to the game, so it saves the world before the server shuts down.

## Next {#next}

### Change a setting

Your server settings sit in clear fields in the **Settings** tab. The details are in the [settings guide](/games/minecraft-java/guides/settings).

@[open](panel:settings)

### Keep it to your friends

Add each friend by name from the **Players** tab, or send your friends an [invite link](/guides/access) so each of them adds themselves, then turn the whitelist on. The details are in the [players guide](/games/minecraft-java/guides/players).

@[command](whitelist on)

If you banned someone and want them back, pick **Unban** on their row in the **Players** tab.

### Your world is safe

We take automatic backups, and you can take one yourself at any time.

@[open](backups)
