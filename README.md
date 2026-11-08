# Discord mark-all-read for Stream Deck

One Stream Deck key that marks every server as read by pressing Vesktop's Read All button.

> An unofficial, community plugin. It is not made by or affiliated with Discord or Elgato.
> Discord is a trademark of Discord Inc.

| Button | What it does |
|---|---|
| **Mark All Servers Read** | Presses the **Read All** button from Vencord's Read All Notifications Button plugin. That button marks every unread server at once. |

## Requirements

- Windows 10 or 11.
- Stream Deck 7.1 or later.
- [Vesktop](https://github.com/Vencord/Vesktop), with Vencord's **Read All Notifications Button** plugin enabled. Official Discord works too when that same Vencord plugin is enabled there.

## Install

1. Double-click `com.incompletebiped.discord-mark-read.streamDeckPlugin` from this repo's [releases](https://github.com/incompletebiped/streamdeck-discord-markallread-plugin/releases) (or build it with `npm run pack`).
2. Drag **Mark All Servers Read** from the **Discord Read** category onto a key.
3. In Vesktop, enable **Read All Notifications Button** under Vencord plugins. You should see a **Read All** button above the server list.
4. Reload Vesktop once with Ctrl+R. The first press after an update can show **Reload** until you do this.
5. Press the Stream Deck key. It asks Vesktop to press that Read All button. The server list is left alone, and no keyboard shortcuts are sent.

## What a press does

The plugin does not log in and does not use a token. It does not send keystrokes. Vesktop stays connected to a local helper, and a press tells Vesktop to click the **Read All** button already drawn by Vencord. That button is the open-source Read All Notifications Button: it acknowledges every unread server channel, voice channel, and active thread in one step. Direct messages are left as that plugin leaves them.

The helper listens on `127.0.0.1` only. The first time the Stream Deck plugin runs, it adds a small hook to the local Vencord renderer so Vesktop can hear that press. Reload Vesktop after that install. A Vesktop update replaces the renderer, and the next press installs the hook again; reload once more when the key says **Reload**. **Enable** means the Read All plugin is off. **Open app** means Vesktop is not running.

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
