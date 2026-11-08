import streamDeck from "@elgato/streamdeck";

import { MarkAllReadAction } from "./actions/mark-all-read.ts";
import { bridge } from "./bridge-instance.ts";
import { ensureInstalledHooks } from "./install-hook.ts";

streamDeck.actions.registerAction(new MarkAllReadAction());

void ensureInstalledHooks().catch((error: unknown) => {
	streamDeck.logger.error(error instanceof Error ? error.message : String(error));
});
void bridge.start().catch((error: unknown) => {
	streamDeck.logger.error(error instanceof Error ? error.message : String(error));
});
streamDeck.connect();
