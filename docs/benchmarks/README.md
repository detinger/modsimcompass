# Sandbox benchmarks

Measured on 20 November 2026 with `runChunk` (the same pure function the Web Worker calls). The configuration was random demand with abandonment (f = 0.1) and hypothetical feedback (α = 0.01) enabled, which is the most expensive path.

Machine: Apple M4 Pro (desktop), Node 26.13. Times are single-threaded wall-clock.

| Workload | Time | Heap after run |
| --- | --- | --- |
| Default: 30 days × 100 replications | 2 ms | 10 MB |
| Default, paired with an alternative | 2 ms | 11 MB |
| 365 days × 1,000 replications, paired | 27 ms | 14 MB |
| Cap: 365 days × 10,000 replications | 113 ms | 25 MB |
| Cap: 365 days × 10,000 replications, paired | 170 ms | 21 MB |

In the browser (headless Chromium 1248, same machine), 30 days × 100 paired replications complete well under a second from clicking **Run model**, including worker start-up and rendering. This was observed in the end-to-end journey test.

## Notes

- **Retained subset:** results keep one full daily trajectory per policy plus replication-level summaries for every completed replication. The CSV says so on every row, and the ZIP manifest says so too.
- **Caps are safeguards, not performance claims:** 365 days and 10,000 replications. They are enforced by validation, not by silently reducing the workload.
- **Not yet measured:** a small-screen phone. PLAN §14 asks for this. The engine cost scales linearly, so even a device ten times slower should stay under two seconds at the cap. This needs confirming on real hardware.

## Reproduce

```bash
npx tsx -e "import {defaultConfig} from './src/domain/sandbox/engine'; import {runChunk} from './src/domain/sandbox/experiment'; const b=defaultConfig(); b.demand.mode='random'; b.horizon=365; b.replications=10000; const t=performance.now(); runChunk(b,null,0,10000); console.log(performance.now()-t,'ms')"
```
