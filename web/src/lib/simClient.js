// Thin promise wrapper around the simulation Web Worker.
let worker;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { res, reqId } = e.data;
      const cb = pending.get(reqId);
      if (cb) { pending.delete(reqId); cb(res); }
    };
  }
  return worker;
}

export function runSim(players, results, opts = {}) {
  return new Promise((resolve) => {
    const reqId = ++seq;
    pending.set(reqId, resolve);
    getWorker().postMessage({ players, results, opts, reqId });
  });
}
