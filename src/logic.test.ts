import assert from "node:assert/strict";
import { test } from "node:test";

import { missingDefaults, parseScriptLine, resolveSettings, titleForError } from "./logic.ts";

test("defaults follow whichever Discord or Vesktop window is in front", () => {
	const settings = resolveSettings(undefined);
	assert.equal(settings.client, "auto");
	assert.equal(settings.processName, "Auto");
	assert.equal(settings.serverCount, 60);
	assert.equal(settings.delayMs, 120);
	assert.equal(settings.climbToTop, true);
	assert.equal(settings.ackRotationHotkey, false);
});

test("client names map to process names", () => {
	assert.equal(resolveSettings({ settingsVersion: 2, client: "auto" }).processName, "Auto");
	assert.equal(resolveSettings({ settingsVersion: 2, client: "stable" }).processName, "Discord");
	assert.equal(resolveSettings({ settingsVersion: 2, client: "ptb" }).processName, "DiscordPTB");
	assert.equal(resolveSettings({ settingsVersion: 2, client: "canary" }).processName, "DiscordCanary");
	assert.equal(resolveSettings({ settingsVersion: 2, client: "vesktop" }).processName, "vesktop");
});

test("saved stable keys move to auto unless the user picked another client", () => {
	assert.equal(resolveSettings({ client: "stable", serverCount: 60 }).client, "auto");
	assert.equal(resolveSettings({ client: "ptb" }).client, "ptb");
	assert.equal(resolveSettings({ client: "canary" }).client, "canary");
	assert.equal(resolveSettings({ client: "vesktop" }).client, "vesktop");
	assert.equal(resolveSettings({ settingsVersion: "2", client: "stable" }).client, "stable");
});

test("numeric settings accept strings and stay inside safe bounds", () => {
	const settings = resolveSettings({ serverCount: "0", delayMs: "5000" });
	assert.equal(settings.serverCount, 1);
	assert.equal(settings.delayMs, 1000);

	const high = resolveSettings({ serverCount: 999, delayMs: 10 });
	assert.equal(high.serverCount, 200);
	assert.equal(high.delayMs, 40);
});

test("checkbox values from the property inspector are booleans", () => {
	assert.equal(resolveSettings({ climbToTop: false }).climbToTop, false);
	assert.equal(resolveSettings({ climbToTop: "false" }).climbToTop, false);
	assert.equal(resolveSettings({ ackRotationHotkey: "true" }).ackRotationHotkey, true);
	assert.equal(resolveSettings({ ackRotationHotkey: "false" }).ackRotationHotkey, false);
});

test("missing defaults include keys saved before Vesktop support", () => {
	assert.equal(missingDefaults(undefined), true);
	assert.equal(missingDefaults({ serverCount: 10 }), true);
	assert.equal(
		missingDefaults({
			client: "stable",
			serverCount: 10,
			delayMs: 80,
			climbToTop: true,
			ackRotationHotkey: false,
		}),
		true,
	);
	assert.equal(
		missingDefaults({
			settingsVersion: 2,
			client: "auto",
			serverCount: 10,
			delayMs: 80,
			climbToTop: true,
			ackRotationHotkey: false,
		}),
		false,
	);
});

test("script lines drive the key title", () => {
	assert.deepEqual(parseScriptLine("PROGRESS 3 60"), { type: "progress", current: 3, total: 60 });
	assert.deepEqual(parseScriptLine("DONE"), { type: "done" });
	assert.deepEqual(parseScriptLine("ERROR NOT_RUNNING Discord or Vesktop is not open"), {
		type: "error",
		code: "NOT_RUNNING",
		message: "Discord or Vesktop is not open",
	});
	assert.deepEqual(parseScriptLine("INFO focused"), { type: "info", message: "focused" });
	assert.deepEqual(parseScriptLine(""), { type: "ignore" });
	assert.equal(titleForError("NOT_RUNNING"), "Not open");
	assert.equal(titleForError("FOCUS"), "Unfocused");
	assert.equal(titleForError("OTHER"), "Failed");
});
