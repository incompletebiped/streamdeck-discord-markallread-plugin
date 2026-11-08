import streamDeck, {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
} from "@elgato/streamdeck";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	missingDefaults,
	parseScriptLine,
	resolveSettings,
	SETTINGS_VERSION,
	titleForError,
	type MarkAllSettings,
	type ResolvedSettings,
} from "../logic";

const ACTION_UUID = "com.incompletebiped.discord-mark-read.mark-all";

@action({ UUID: ACTION_UUID })
export class MarkAllReadAction extends SingletonAction<MarkAllSettings> {
	private running = false;

	override async onWillAppear(ev: WillAppearEvent<MarkAllSettings>): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}

		const resolved = resolveSettings(ev.payload.settings);
		if (missingDefaults(ev.payload.settings)) {
			await ev.action.setSettings(settingsPayload(resolved));
		}
		if (!this.running) {
			await ev.action.setTitle(resolved.ackRotationHotkey ? "" : "Setup");
		}
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MarkAllSettings>): Promise<void> {
		if (!ev.action.isKey() || this.running) {
			return;
		}
		const resolved = resolveSettings(ev.payload.settings);
		await ev.action.setTitle(resolved.ackRotationHotkey ? "" : "Setup");
	}

	override async onKeyDown(ev: KeyDownEvent<MarkAllSettings>): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}

		if (this.running) {
			await ev.action.showAlert();
			return;
		}

		const settings = resolveSettings(ev.payload.settings);
		if (!settings.ackRotationHotkey) {
			await ev.action.setTitle("Setup");
			await ev.action.showAlert();
			streamDeck.logger.warn("Mark all read is waiting for the rotation-hotkey confirmation.");
			return;
		}

		this.running = true;
		try {
			await ev.action.setTitle("...");
			await runMarkAll(settings, async (current, total) => {
				await ev.action.setTitle(`${current}/${total}`);
			});
			await ev.action.setTitle("");
			await ev.action.showOk();
		} catch (error) {
			const code = error instanceof MarkReadError ? error.code : "FAILED";
			const message = error instanceof Error ? error.message : String(error);
			streamDeck.logger.error(message);
			await ev.action.setTitle(titleForError(code));
			await ev.action.showAlert();
		} finally {
			this.running = false;
		}
	}
}

export class MarkReadError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
	}
}

function settingsPayload(settings: ResolvedSettings): MarkAllSettings {
	return {
		settingsVersion: SETTINGS_VERSION,
		client: settings.client,
		serverCount: settings.serverCount,
		delayMs: settings.delayMs,
		climbToTop: settings.climbToTop,
		ackRotationHotkey: settings.ackRotationHotkey,
	};
}

function scriptFile(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "mark-all-read.ps1");
}

async function runMarkAll(
	settings: ResolvedSettings,
	onProgress: (current: number, total: number) => Promise<void>,
): Promise<void> {
	const script = scriptFile();
	await access(script);

	const powershell = path.join(
		process.env.SystemRoot ?? "C:\\Windows",
		"System32",
		"WindowsPowerShell",
		"v1.0",
		"powershell.exe",
	);

	streamDeck.logger.info(
		`Marking ${settings.serverCount} servers in ${settings.processName} (${settings.delayMs} ms).`,
	);

	const child = spawn(
		powershell,
		[
			"-NoProfile",
			"-ExecutionPolicy",
			"Bypass",
			"-File",
			script,
			"-ServerCount",
			String(settings.serverCount),
			"-DelayMs",
			String(settings.delayMs),
			"-ProcessName",
			settings.processName,
			"-ClimbToTop",
			settings.climbToTop ? "true" : "false",
		],
		{
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
		},
	);

	let failure: MarkReadError | undefined;
	const stderr: string[] = [];
	const exitCodePromise = waitForExit(child);
	child.stderr?.setEncoding("utf8");
	child.stderr?.on("data", (chunk: string) => {
		stderr.push(chunk);
	});

	if (!child.stdout) {
		throw new MarkReadError("FAILED", "Could not read the mark-read script.");
	}
	const lines = createInterface({ input: child.stdout });
	for await (const line of lines) {
		const event = parseScriptLine(line);
		if (event.type === "progress") {
			await onProgress(event.current, event.total);
		} else if (event.type === "error") {
			failure = new MarkReadError(event.code, event.message || event.code);
			streamDeck.logger.error(`${event.code} ${event.message}`);
		} else if (event.type === "info") {
			streamDeck.logger.info(event.message);
		} else if (event.type === "done") {
			streamDeck.logger.info("Finished marking servers read.");
		} else if (line.trim()) {
			streamDeck.logger.info(line.trim());
		}
	}

	const exitCode = await exitCodePromise;
	if (stderr.length > 0) {
		streamDeck.logger.warn(stderr.join("").trim());
	}
	if (failure) {
		throw failure;
	}
	if (exitCode !== 0) {
		throw new MarkReadError("FAILED", `Mark-read script exited with code ${exitCode}.`);
	}
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<number | null> {
	return new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("close", (code) => resolve(code));
	});
}
