# Discord mark-all-read for Stream Deck

One Stream Deck key that marks every server as read in the Discord desktop app or in Vesktop.

> An unofficial, community plugin. It is not made by or affiliated with Discord or Elgato.
> Discord is a trademark of Discord Inc.

| Button | What it does |
|---|---|
| **Mark All Servers Read** | Brings Discord or Vesktop forward and walks the server list. Each server is marked read with the app's own shortcuts. |

## Requirements

- Windows 10 or 11.
- Stream Deck 7.1 or later.
- Discord desktop (Stable, Public Test Build, or Canary) or [Vesktop](https://github.com/Vencord/Vesktop). The browser app does not receive these shortcuts. The key uses whichever of those windows is in front.

## Install

1. Double-click `com.incompletebiped.discord-mark-read.streamDeckPlugin` from this repo's [releases](https://github.com/incompletebiped/streamdeck-discord-markallread-plugin/releases) (or build it with `npm run pack`).
2. Drag **Mark All Servers Read** from the **Discord Read** category onto a key.
3. Click that key in the Stream Deck app. Set **Servers to visit** to at least the number of icons in your server list, and check **Ctrl+Alt+Arrow does not rotate my display**.
4. In Discord or Vesktop, expand any server folders. Press the key and leave the keyboard alone until the count finishes.

The key shows **Setup** and a warning triangle until that checkbox is saved. That warning means the setup check is still open. It does not mean the app failed to launch. Some graphics drivers use Ctrl+Alt+Arrow to rotate the screen, and Discord and Vesktop use the same chord to move between servers. Turn the rotate hotkey off before checking the box. Leave **App** on **Whichever is open** to drive the window in front, or pick one client.

## What a press does

The plugin does not log in and does not use a token. It only sends the app's documented shortcuts, and only after that window is in front:

1. Ctrl+Alt+Up until the selection is at the top of the server list.
2. Ctrl+Alt+Down once, which leaves Home so direct messages are skipped.
3. Shift+Esc marks the current server read, then Ctrl+Alt+Down moves to the next server.

If that window is not in front, the key stops and no shortcuts are sent. Direct messages are not marked. A collapsed folder counts as one icon, so expand folders first. The visit count maxes out at 200. If a server stays unread, raise **Pause between steps**. When both Discord and Vesktop are open, the key uses the one in front.

## Develop

```sh
npm install
npm test
npm run build         # bundles to com.incompletebiped.discord-mark-read.sdPlugin/bin
npx streamdeck link com.incompletebiped.discord-mark-read.sdPlugin   # once: installs the dev plugin into Stream Deck
npm run watch         # rebuild and restart the plugin on save
npm run validate
npm run pack          # dist/com.incompletebiped.discord-mark-read.streamDeckPlugin
```

Node.js 24 or later is required to build. People installing a release do not need Node. To debug the running plugin, set `"Debug": "enabled"` under `Nodejs` in the manifest.
