import streamDeck, { action, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";

import { bridge } from "../bridge-instance.ts";
import { discordClientOpen, ensureInstalledHooks } from "../install-hook.ts";
import { titleForBridge } from "../logic.ts";

const ACTION_UUID = "com.incompletebiped.discord-mark-read.mark-all";

@action({ UUID: ACTION_UUID })
export class MarkAllReadAction extends SingletonAction {
	private running = false;

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		if (!ev.action.isKey() || this.running) {
			return;
		}
		await ev.action.setTitle("");
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}
		if (this.running) {
			await ev.action.showAlert();
			return;
		}

		this.running = true;
		try {
			await ev.action.setTitle("...");
			await ensureInstalledHooks();
			const result = await bridge.requestMark();
			if (result.ok) {
				streamDeck.logger.info("Pressed the Read All button.");
				await ev.action.setTitle("");
				await ev.action.showOk();
				return;
			}

			streamDeck.logger.warn(result.message);
			const code = result.code === "NO_CLIENT" && !(await discordClientOpen()) ? "OPEN" : result.code;
			await ev.action.setTitle(titleForBridge(code === "NO_CLIENT" ? "RELOAD" : code));
			await ev.action.showAlert();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			streamDeck.logger.error(message);
			await ev.action.setTitle(titleForBridge("FAILED"));
			await ev.action.showAlert();
		} finally {
			this.running = false;
		}
	}
}
