import { simulateMany } from './sim.js';

self.onmessage = (e) => {
  const { players, results, opts, reqId } = e.data;
  const res = simulateMany(players, results, opts);
  self.postMessage({ res, reqId });
};
