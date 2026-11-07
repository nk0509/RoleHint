const encoder = new TextEncoder();

// Sends newline-delimited JSON. The pings keep the connection open while the model thinks silently.
export function eventStream(run) {
  let abort = () => {};
  let timer;
  const body = new ReadableStream({
    async start(controller) {
      const send = (event) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The visitor left; run() stops through abort.
        }
      };
      timer = setInterval(() => send({ type: "ping" }), 10_000);
      run(send, (fn) => (abort = fn)).finally(() => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(timer);
      abort();
    },
  });
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
