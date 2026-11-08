import { HOOK_MARKER } from "./hook.ts";

export function appendHook(source: string, hook: string): string {
	if (source.includes(HOOK_MARKER)) {
		return source;
	}
	return `${source.replace(/\s*$/, "")}\n${hook.trim()}\n`;
}

export type BridgeCode = "NO_CLIENT" | "MISSING" | "FAILED" | "OPEN" | "RELOAD";

export function titleForBridge(code: BridgeCode): string {
	switch (code) {
		case "OPEN":
			return "Open app";
		case "MISSING":
			return "Enable";
		case "NO_CLIENT":
		case "RELOAD":
			return "Reload";
		default:
			return "Failed";
	}
}
