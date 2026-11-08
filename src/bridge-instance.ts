import { BRIDGE_PORT, MarkReadBridge } from "./bridge.ts";

export const bridge = new MarkReadBridge(BRIDGE_PORT);
