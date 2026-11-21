import { KINDS, TOOL_ORDER } from '../../domain/artefacts/kinds';
import { METHOD_BY_ID, type MethodId } from '../../domain/methods/registry';
import { TOOL_META } from '../toolbox/toolMeta';

/** Where an in-app address leads, in words: used as the accessible name of the small arrow next to a glossary term. */
export function destination(to: string): string {
  const method = /^\/learn\/methods\/([\w-]+)$/.exec(to)?.[1];
  if (method && Object.hasOwn(METHOD_BY_ID, method)) return `${METHOD_BY_ID[method as MethodId].name} in Methods at a glance`;
  const kind = TOOL_ORDER.find((k) => KINDS[k].toolPath === to);
  if (kind) return `the ${TOOL_META[kind].name} tool`;
  if (to === '/toolbox/artefacts') return 'My artefacts';
  return to;
}
