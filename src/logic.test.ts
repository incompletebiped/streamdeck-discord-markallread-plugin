import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { MarkReadBridge } from "./bridge.ts";
import { hookSource } from "./hook.ts";
import { ensureHooks } from "./install-hook.ts";
import { appendHook, titleForBridge } from "./logic.ts";

test("the Vesktop hook is appended once", () => {
	const hook = hookSource(47655);
	const once = appendHook("bundle();\n", hook);
	assert.match(once, /streamdeck-discord-mark-read/);
	assert.match(once, /127\.0\.0\.1:47655/);
	assert.equal(appendHook(once, hook), once);
});

test("key titles name the next step", () => {
	assert.equal(titleForBridge("OPEN"), "Open app");
	assert.equal(titleForBridge("RELOAD"), "Reload");
	assert.equal(titleForBridge("MISSING"), "Enable");
	assert.equal(titleForBridge("FAILED"), "Failed");
});

test("a connected client can press the Read All button", async () => {
	const bridge = new MarkReadBridge(0);
	const port = await bridge.start();
	try {
		const pending = fetch(`http://127.0.0.1:${port}/wait`).then(async (res) => {
			const text = (await res.text()).trim();
			assert.equal(text, "mark");
			const done = await fetch(`http://127.0.0.1:${port}/done`, {
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: "button",
			});
			assert.equal(done.status, 204);
		});

		await waitFor(() => bridge.connected > 0);
		const result = await bridge.requestMark();
		await pending;
		assert.deepEqual(result, { ok: true });
	} finally {
		await bridge.stop();
	}
});

test("a press with no client asks for a reload", async () => {
	const bridge = new MarkReadBridge(0);
	await bridge.start();
	try {
		const result = await bridge.requestMark();
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.code, "NO_CLIENT");
		}
	} finally {
		await bridge.stop();
	}
});

test("installing the hook writes it onto a Vencord renderer copy", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "mark-read-"));
	const file = path.join(directory, "vencordDesktopRenderer.js");
	const { writeFile } = await import("node:fs/promises");
	await writeFile(file, "bundle();\n");
	try {
		const wrote = await ensureHooks([file], hookSource(1));
		assert.deepEqual(wrote, [file]);
		const installed = await readFile(file, "utf8");
		assert.match(installed, /vc-ranb-button/);
		assert.deepEqual(await ensureHooks([file], hookSource(1)), []);
	} finally {
		await rm(directory, { recursive: true });
	}
});

async function waitFor(ready: () => boolean): Promise<void> {
	const started = Date.now();
	while (!ready()) {
		if (Date.now() - started > 2000) {
			throw new Error("timed out waiting");
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}
