import { createContext, useContext } from 'react';
import type { ProjectDoc } from '../../domain/passport/schema';

/** The passport being shown: the active project (editable) or the worked example (read only). */
export interface PassportValue {
  doc: ProjectDoc;
  update: (fn: (d: ProjectDoc) => void) => void;
  readOnly: boolean;
  /** Route prefix: `/project` or `/example`. */
  base: string;
}

/**
 * The overview of the passport being shown. `/project` itself is the Project page (all projects and the templates),
 * so the open project's overview has its own address; the worked example's overview stays at `/example`.
 */
export const overviewOf = (base: string) => (base === '/project' ? '/project/overview' : base);

export const PassportContext = createContext<PassportValue | null>(null);

export function usePassport(): PassportValue {
  const v = useContext(PassportContext);
  if (!v) throw new Error('usePassport outside PassportContext');
  return v;
}
