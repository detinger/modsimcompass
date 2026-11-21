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

export const PassportContext = createContext<PassportValue | null>(null);

export function usePassport(): PassportValue {
  const v = useContext(PassportContext);
  if (!v) throw new Error('usePassport outside PassportContext');
  return v;
}
