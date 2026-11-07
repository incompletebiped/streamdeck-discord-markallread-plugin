export type DiscordClient = "stable" | "ptb" | "canary";

export type MarkAllSettings = {
	client?: DiscordClient;
	serverCount?: number | string;
	delayMs?: number | string;
	climbToTop?: boolean | string | number;
	ackRotationHotkey?: boolean | string | number;
};

export type ResolvedSettings = {
	client: DiscordClient;
	processName: "Discord" | "DiscordPTB" | "DiscordCanary";
	serverCount: number;
	delayMs: number;
	climbToTop: boolean;
	ackRotationHotkey: boolean;
};

const PROCESS_NAMES = {
	stable: "Discord",
	ptb: "DiscordPTB",
	canary: "DiscordCanary",
} as const;

export type ScriptEvent =
	| { type: "progress"; current: number; total: number }
	| { type: "done" }
	| { type: "error"; code: string; message: string }
	| { type: "info"; message: string }
	| { type: "ignore" };

export function resolveSettings(settings: MarkAllSettings | undefined): ResolvedSettings {
	const client: DiscordClient =
		settings?.client === "ptb" || settings?.client === "canary" ? settings.client : "stable";

	return {
		client,
		processName: PROCESS_NAMES[client],
		serverCount: readNumber(settings?.serverCount, 60, 1, 200),
		delayMs: readNumber(settings?.delayMs, 120, 40, 1000),
		climbToTop: readBool(settings?.climbToTop, true),
		ackRotationHotkey: readBool(settings?.ackRotationHotkey, false),
	};
}

export function missingDefaults(settings: MarkAllSettings | undefined): boolean {
	if (!settings) {
		return true;
	}

	return (
		settings.client === undefined ||
		settings.serverCount === undefined ||
		settings.delayMs === undefined ||
		settings.climbToTop === undefined ||
		settings.ackRotationHotkey === undefined
	);
}

export function parseScriptLine(line: string): ScriptEvent {
	const text = line.trim();
	if (text.length === 0) {
		return { type: "ignore" };
	}

	if (text.startsWith("PROGRESS ")) {
		const [, current, total] = text.split(/\s+/);
		const parsedCurrent = Number(current);
		const parsedTotal = Number(total);
		if (!Number.isFinite(parsedCurrent) || !Number.isFinite(parsedTotal)) {
			return { type: "ignore" };
		}
		return { type: "progress", current: parsedCurrent, total: parsedTotal };
	}

	if (text === "DONE") {
		return { type: "done" };
	}

	if (text.startsWith("ERROR ")) {
		const parts = text.split(/\s+/);
		return {
			type: "error",
			code: parts[1] ?? "FAILED",
			message: parts.slice(2).join(" "),
		};
	}

	if (text.startsWith("INFO ")) {
		return { type: "info", message: text.slice(5) };
	}

	return { type: "ignore" };
}

export function titleForError(code: string): string {
	switch (code) {
		case "NOT_RUNNING":
			return "Open Discord";
		case "FOCUS":
			return "Unfocused";
		default:
			return "Failed";
	}
}

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
	if (!Number.isFinite(parsed)) {
		return fallback;
	}
	return Math.min(max, Math.max(min, Math.round(parsed)));
}

function readBool(value: unknown, fallback: boolean): boolean {
	if (typeof value === "boolean") {
		return value;
	}
	if (value === "true" || value === "on" || value === 1 || value === "1") {
		return true;
	}
	if (value === "false" || value === "off" || value === 0 || value === "0") {
		return false;
	}
	return fallback;
}
