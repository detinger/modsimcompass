/**
 * Named sandbox fixtures referenced by content. Evidence of kind 'sandbox' and
 * numeric `fixtureCheck`s are computed live from these, never typed in by hand.
 * Provenance: synthetic teaching fixtures (no real student service records).
 */
import { defaultConfig } from '../domain/sandbox/engine';
import type { SandboxConfig } from '../domain/sandbox/types';

function make(mutate: (c: SandboxConfig) => void): SandboxConfig {
  const c = defaultConfig();
  mutate(c);
  return c;
}

export const FIXTURES: Record<string, { label: string; description: string; config: SandboxConfig }> = {
  'fx-accumulation': {
    label: 'Accumulation (5 days)',
    description: 'B0 = 0, arrivals 12/day, capacity 10/day, 5 days.',
    config: make((c) => { c.horizon = 5; c.initialBacklog = 0; c.demand.constant = 12; c.capacity.direct = 10; }),
  },
  'fx-balanced': {
    label: 'Balanced',
    description: 'B0 = 0, arrivals 10/day, capacity 10/day, 30 days.',
    config: make((c) => { c.horizon = 30; c.demand.constant = 10; c.capacity.direct = 10; }),
  },
  'fx-drain': {
    label: 'Drain (5 days)',
    description: 'B0 = 20, arrivals 5/day, capacity 10/day, 5 days.',
    config: make((c) => { c.horizon = 5; c.initialBacklog = 20; c.demand.constant = 5; c.capacity.direct = 10; }),
  },
  'fx-closed': {
    label: 'Closed office (2 days)',
    description: 'B0 = 3, arrivals [2, 4], capacities [0, 0].',
    config: make((c) => { c.horizon = 2; c.initialBacklog = 3; c.demand.mode = 'list'; c.demand.list = [2, 4]; c.capacity.mode = 'list'; c.capacity.list = [0, 0]; }),
  },
  'fx-abandon-1': {
    label: 'Abandonment (1 day)',
    description: 'B0 = 0, arrivals 12, capacity 10, abandonment fraction 0.25, one day.',
    config: make((c) => { c.horizon = 1; c.demand.constant = 12; c.capacity.direct = 10; c.abandonment = { enabled: true, fraction: 0.25 }; }),
  },
  'fx-abandon-10': {
    label: 'Abandonment policy (10 days)',
    description: 'B0 = 0, arrivals 12/day, capacity 10/day, abandonment 0.5, 10 days.',
    config: make((c) => { c.horizon = 10; c.demand.constant = 12; c.capacity.direct = 10; c.abandonment = { enabled: true, fraction: 0.5 }; }),
  },
  'fx-no-abandon-10': {
    label: 'No abandonment (10 days)',
    description: 'B0 = 0, arrivals 12/day, capacity 10/day, no abandonment, 10 days.',
    config: make((c) => { c.horizon = 10; c.demand.constant = 12; c.capacity.direct = 10; }),
  },
  'fx-omitted-source': {
    label: 'With forwarded requests (5 days)',
    description: 'B0 = 0, arrivals 12/day from the main desk plus 3/day forwarded from the library, capacity 14/day, 5 days.',
    config: make((c) => { c.horizon = 5; c.demand.constant = 15; c.capacity.direct = 14; }),
  },
  'fx-without-source': {
    label: 'Main desk only (5 days)',
    description: 'B0 = 0, arrivals 12/day (main desk only), capacity 14/day, 5 days.',
    config: make((c) => { c.horizon = 5; c.demand.constant = 12; c.capacity.direct = 14; }),
  },
  'fx-random-30': {
    label: 'Variable demand (30 days)',
    description: 'B0 = 0, arrivals ∈ {8, 12, 16} with probabilities {0.25, 0.5, 0.25}, capacity 12/day, 30 days, seed “modsim-1”.',
    config: make((c) => { c.horizon = 30; c.demand.mode = 'random'; c.capacity.direct = 12; c.replications = 100; c.seed = 'modsim-1'; }),
  },
  'fx-week-closed': {
    label: 'Weekend closure (14 days)',
    description: 'B0 = 0, arrivals 10/day every day, capacity 14 on weekdays, closed at weekends.',
    config: make((c) => { c.horizon = 14; c.demand.constant = 10; c.capacity.direct = 14; c.schedule.enabled = true; }),
  },
};
