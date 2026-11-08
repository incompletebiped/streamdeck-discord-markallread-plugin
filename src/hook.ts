export const HOOK_MARKER = "/* streamdeck-discord-mark-read */";

export function hookSource(port: number): string {
	return `${HOOK_MARKER}
(() => {
  if (globalThis.__streamDeckMarkRead) return;
  globalThis.__streamDeckMarkRead = true;
  const root = "http://127.0.0.1:${port}";

  function loopbackFetch(url, options) {
    const init = Object.assign({ cache: "no-store" }, options);
    try {
      return fetch(url, Object.assign({ targetAddressSpace: "loopback" }, init));
    } catch (error) {
      return fetch(url, init);
    }
  }

  async function pressReadAll() {
    const started = Date.now();
    while (Date.now() - started < 2000) {
      const button = document.querySelector(".vc-ranb-button");
      if (button instanceof HTMLElement) {
        button.click();
        return "button";
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return "missing";
  }

  async function poll() {
    let delay = 500;
    try {
      const res = await loopbackFetch(root + "/wait");
      const text = res.ok ? (await res.text()).trim() : "";
      if (text === "mark") {
        const how = await pressReadAll();
        await loopbackFetch(root + "/done", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: how,
        });
        delay = 100;
      }
    } catch (error) {
      delay = 1000;
    }
    setTimeout(poll, delay);
  }

  poll();
})();
`;
}
