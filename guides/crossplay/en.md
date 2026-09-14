## What crossplay does

Your server is a Java server. Crossplay lets **Bedrock** players — phone, console and Windows 10/11 — join that same server and play with you, with nothing extra to set up.

We install `Geyser` and `Floodgate` for you and keep them updated on every start. All you do is flip one switch.

> [!note] Crossplay works on Paper, Purpur, Fabric and NeoForge. If your server is Vanilla or Forge, switch the type from the Version tab first.

## Turn it on

In the **Settings** tab turn on **Let Bedrock players in** and save. The server restarts right away, and the first start takes a moment while the files download.

@[open](panel:settings)

On Fabric we also install **Fabric API** with them, because Geyser and Floodgate refuse to load without it. You will see it in the Mods tab; leave it there, and keep it if you turn crossplay off — other mods use it too.

If a download fails, your server still starts — without crossplay — and prints a warning line in the console. We never block a start on a download.

## The address Bedrock players use

Java players join with the address you already know:

@[field](server.address)

Bedrock players use the same IP but the **Bedrock port**. The Bedrock address appears on your server page next to the Java one once crossplay is on — while it is off, or on a Vanilla or Forge server, nothing is listening on that port, so we do not show it. Then, inside the game:

1. Open **Play**, then **Servers**
2. Scroll down and tap **Add Server**
3. Give it any name, then put the IP in Server Address
4. Put the Bedrock port in Port
5. Join and play

## Bedrock player names

A Bedrock player's name on your server starts with a **dot**, and spaces become `_`. So a player called `Gamer Tag` joins as `.Gamer_Tag`.

The dot is deliberate: it stops a Bedrock player from taking over a Java player's name.

On Paper and Purpur we turn their name check (`perform-username-validation`) off so the dot gets through — otherwise Bedrock players are kicked with "Failed to verify username".

```txt
op .Gamer_Tag
kick .Gamer_Tag
```

## Whitelist your friends

In the **Players** tab type your friend's name and press add. For a Java player type the name as it is; for a Bedrock player type the gamertag with a dot in front and its spaces kept — we convert them.

@[open](panel:players)

> [!warning] A Bedrock player who has never joined cannot be added with the plain `whitelist add` command. We run the Floodgate command for you when you add them from the tab.

## Memory

Crossplay runs an extra bridge inside the same server, and each Bedrock player costs more memory. For a comfortable game keep it at **2GB or more**; on a 1GB server expect lag.

> [!note] The player counter on your server page counts Bedrock players once they join, exactly like Java players.

## Check whether joining works

An enabled crossplay switch does not guarantee Bedrock responds. Watch the console for Geyser's startup line, and if a Bedrock player cannot join, check the settings and the console. The versions Geyser supports are listed in its documentation at https://geysermc.org/wiki/geyser/supported-versions/.

Crossplay joins the Java world. Choose native Bedrock hosting for native Bedrock worlds and addons.
