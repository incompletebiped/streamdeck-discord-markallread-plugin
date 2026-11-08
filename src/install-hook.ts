import { execFile } from "node:child_process";
import { copyFile, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { BRIDGE_PORT } from "./bridge.ts";
import { hookSource } from "./hook.ts";
import { appendHook } from "./logic.ts";

export function vencordRendererPaths(): string[] {
	const appData = process.env.APPDATA ?? "";
	const localAppData = process.env.LOCALAPPDATA ?? "";
	const paths = [
		path.join(appData, "vesktop", "sessionData", "vencordFiles", "vencordDesktopRenderer.js"),
		path.join(appData, "Vencord", "dist", "vencordDesktopRenderer.js"),
		path.join(localAppData, "Vencord", "dist", "vencordDesktopRenderer.js"),
	];
	return paths.filter((file) => file.length > 0);
}

export async function ensureHooks(files: string[], hook = hookSource(BRIDGE_PORT)): Promise<string[]> {
	const wrote: string[] = [];
	for (const file of files) {
		let current: string;
		try {
			current = await readFile(file, "utf8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				continue;
			}
			throw error;
		}

		const next = appendHook(current, hook);
		if (next === current) {
			continue;
		}

		const backup = `${file}.before-streamdeck`;
		try {
			await readFile(backup);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error;
			}
			await copyFile(file, backup);
		}

		const temporary = `${file}.streamdeck-tmp`;
		await writeFile(temporary, next, "utf8");
		await copyFile(temporary, file);
		await unlink(temporary);
		wrote.push(file);
	}
	return wrote;
}

export function ensureInstalledHooks(): Promise<string[]> {
	return ensureHooks(vencordRendererPaths());
}

export function discordClientOpen(): Promise<boolean> {
	const images = ["vesktop.exe", "Discord.exe", "DiscordPTB.exe", "DiscordCanary.exe"];
	return Promise.all(images.map(imageRunning)).then((results) => results.some(Boolean));
}

function imageRunning(image: string): Promise<boolean> {
	return new Promise((resolve) => {
		execFile("tasklist", ["/FI", `IMAGENAME eq ${image}`, "/NH"], { windowsHide: true }, (error, stdout) => {
			resolve(!error && stdout.toLowerCase().includes(image.toLowerCase()));
		});
	});
}
