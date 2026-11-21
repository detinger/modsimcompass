import type { ReactNode } from 'react';
import { Hammer } from 'lucide-react';
import { useArtefactEditor } from '../../app/artefacts';
import { kindDef, KINDS } from '../../domain/artefacts/kinds';
import type { ArtefactData, ArtefactKind } from '../../domain/artefacts/types';
import { ToolPage } from './ToolPage';

/**
 * Placeholder body of a tool that is still being built. It exercises the shared frame end to end:
 * the artefact is named, saved, exported and added to a project exactly as it will be in the finished tool.
 * `example` fills the artefact with a small made-up example so there is something to save.
 */
export function StubTool<K extends ArtefactKind>({ kind, id, example, intro }: { kind: K; id?: string; example: (draft: ArtefactData[K]) => void; intro?: ReactNode }) {
  const editor = useArtefactEditor(kind, id);
  const lines = kindDef(kind).summary(editor.artefact.data);
  return (
    <ToolPage kind={kind} editor={editor} intro={intro}>
      <section className="tbx-stub" aria-labelledby="tbx-stub-title">
        <span className="tbx-stub-icon" aria-hidden="true"><Hammer size={22} /></span>
        <div>
          <h2 id="tbx-stub-title">This tool is being built</h2>
          <p className="muted">The frame around it already works: name the artefact, export it, add it to a project.</p>
          <ul className="tbx-stub-lines">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => editor.setData(example)}>Fill in a made-up example</button>
            <button type="button" className="btn ghost" onClick={() => editor.setData((d) => { Object.assign(d, KINDS[kind].empty()); })}>Clear</button>
          </div>
        </div>
      </section>
    </ToolPage>
  );
}
