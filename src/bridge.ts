import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export const BRIDGE_PORT = 47655;

type Waiter = {
	respond: (body: string) => void;
	timer: ReturnType<typeof setTimeout>;
};

export type MarkResult =
	| { ok: true }
	| { ok: false; code: "NO_CLIENT" | "MISSING" | "FAILED"; message: string };

export class MarkReadBridge {
private readonly port: number;
	private server: Server | null = null;
	private waiters: Waiter[] = [];
	private expectDone = 0;
	private doneBodies: string[] = [];
	private onDone: ((body: string) => void) | null = null;

	constructor(port = BRIDGE_PORT) {
		this.port = port;
	}

	get connected(): number {
		return this.waiters.length;
	}

	start(): Promise<number> {
		if (this.server) {
			return Promise.resolve(this.port);
		}

		const server = createServer((req, res) => {
			this.handle(req, res);
		});
		this.server = server;
		server.timeout = 0;
		server.requestTimeout = 0;

		return new Promise((resolve, reject) => {
			server.once("error", reject);
			server.listen(this.port, "127.0.0.1", () => {
				server.off("error", reject);
				const address = server.address();
				resolve(typeof address === "object" && address ? address.port : this.port);
			});
		});
	}

	stop(): Promise<void> {
		for (const waiter of this.waiters.splice(0)) {
			clearTimeout(waiter.timer);
			waiter.respond("idle");
		}
		const server = this.server;
		this.server = null;
		if (!server) {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			server.close(() => resolve());
		});
	}

	requestMark(timeoutMs = 4000): Promise<MarkResult> {
		if (this.waiters.length === 0) {
			return Promise.resolve({
				ok: false,
				code: "NO_CLIENT",
				message: "Vesktop has not connected. Reload it after the hook is installed.",
			});
		}

		const targets = this.waiters.splice(0);
		this.expectDone = targets.length;
		this.doneBodies = [];

		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.onDone = null;
				resolve(resultFromBodies(this.doneBodies));
			}, timeoutMs);

			this.onDone = (body) => {
				this.doneBodies.push(body);
				if (this.doneBodies.length < this.expectDone) {
					return;
				}
				clearTimeout(timer);
				this.onDone = null;
				resolve(resultFromBodies(this.doneBodies));
			};

			for (const waiter of targets) {
				clearTimeout(waiter.timer);
				waiter.respond("mark");
			}
		});
	}

	private handle(req: IncomingMessage, res: ServerResponse): void {
		setCors(res);
		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}

		const path = (req.url ?? "/").split("?")[0];
		if (req.method === "GET" && path === "/wait") {
			this.hold(res);
			return;
		}
		if (req.method === "POST" && path === "/done") {
			void readBody(req).then((body) => {
				this.onDone?.(body.trim());
				res.writeHead(204);
				res.end();
			});
			return;
		}

		res.writeHead(404);
		res.end();
	}

	private hold(res: ServerResponse): void {
		const waiter: Waiter = {
			respond: (body) => {
				this.waiters = this.waiters.filter((item) => item !== waiter);
				if (!res.writableEnded) {
					res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
					res.end(body);
				}
			},
			timer: setTimeout(() => waiter.respond("idle"), 20000),
		};
		this.waiters.push(waiter);
		res.on("close", () => {
			if (!res.writableEnded) {
				clearTimeout(waiter.timer);
				this.waiters = this.waiters.filter((item) => item !== waiter);
			}
		});
	}
}

function resultFromBodies(bodies: string[]): MarkResult {
	if (bodies.some((body) => body === "button")) {
		return { ok: true };
	}
	if (bodies.some((body) => body === "missing")) {
		return {
			ok: false,
			code: "MISSING",
			message: "Enable Vencord's Read All Notifications Button.",
		};
	}
	return { ok: false, code: "FAILED", message: "The Read All button did not answer." };
}

function setCors(res: ServerResponse): void {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Private-Network", "true");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		let size = 0;
		req.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size <= 64) {
				chunks.push(chunk);
			}
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", () => resolve(""));
	});
}
