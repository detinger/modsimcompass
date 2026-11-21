import type { ComponentType } from 'react';
import type { MethodId } from '../../../domain/methods/registry';
import { METHOD_PICTURE_TEXT } from '../../../content/learn/pictures';
import { AbmPicture, CellularPicture } from './emergence';
import { DesPicture, PetriPicture, QueueingPicture, SystemDynamicsPicture } from './processes';
import { CbSemPicture, PathPicture, PlsPicture } from './relationships';
import { MarkovPicture, MonteCarloPicture } from './uncertain';

/** One small moving picture per method. Each draws on the same 280 × 150 canvas and takes its text equivalent as `label`. */
export const METHOD_PICTURES: Record<MethodId, ComponentType<{ label: string }>> = {
  'path-analysis': PathPicture,
  'cb-sem': CbSemPicture,
  'pls-sem': PlsPicture,
  'petri-nets': PetriPicture,
  'monte-carlo': MonteCarloPicture,
  'markov-chains': MarkovPicture,
  'system-dynamics': SystemDynamicsPicture,
  'queueing-theory': QueueingPicture,
  des: DesPicture,
  'cellular-automata': CellularPicture,
  abm: AbmPicture,
};

export function MethodPicture({ id }: { id: MethodId }) {
  const P = METHOD_PICTURES[id];
  return <P label={METHOD_PICTURE_TEXT[id]} />;
}
