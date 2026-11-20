import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../../app/store';
import type { ProjectDoc } from '../../domain/passport/schema';
import { compassWarnings, STEPS, stepsStarted } from '../../domain/passport/compass';
import { buildExportZip, EXPORT_PARTS, renderPart, slugify, type ExportPart } from '../../exports/bundle';
import { runIsStale, describeRunStatus } from '../../exports/runInfo';
import { Callout, Dialog, downloadFile } from '../../ui/controls';

export function ExportDialog({ doc, onClose, onDownloaded }: { doc: ProjectDoc; onClose: () => void; onDownloaded: () => void }) {
  const { prefs, setPrefs, toast } = useStore();
  const [selected, setSelected] = useState<ExportPart[]>(['passport-md', 'project-json', 'report-html', ...(doc.sandbox.lastRun ? ['results-csv' as const] : [])]);
  const [previewPart, setPreviewPart] = useState<ExportPart>('passport-md');
  const opts = { includeAuthor: prefs.includeAuthor, generatedAt: new Date().toISOString() };
  const slug = slugify(doc.passport.identity.title);
  const preview = useMemo(() => renderPart(doc, previewPart, opts), [doc, previewPart, prefs.includeAuthor]); // eslint-disable-line react-hooks/exhaustive-deps
  const started = stepsStarted(doc.passport).length;
  const open = compassWarnings(doc).filter((w) => w.severity !== 'tip').length;
  const run = doc.sandbox.lastRun;
  const stale = runIsStale(doc);
  const toggle = (id: ExportPart) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const done = (what: string) => { onDownloaded(); toast(`${what} generated. Use your browser download to save it.`, 'success'); };
  return (
    <Dialog title="Export project" onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn primary" disabled={selected.length === 0} onClick={() => {
          downloadFile(`${slug}-modsim-export.zip`, buildExportZip(doc, selected, opts), 'application/zip');
          done('ZIP file');
        }}><Download size={16} aria-hidden="true" /> Download ZIP ({selected.length} file{selected.length === 1 ? '' : 's'} + manifest)</button>
      </>}>
      <p className="muted">Downloading saves a file on this device; it is not a cloud save and nothing is uploaded. Specialist apps do not receive the project automatically.</p>
      <div className="split">
        <div>
          <fieldset>
            <legend>Include</legend>
            {EXPORT_PARTS.map((p) => {
              const unavailable = p.id === 'results-csv' && !run;
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                  <label className="check" style={{ opacity: unavailable ? 0.6 : 1 }}>
                    <input type="checkbox" checked={selected.includes(p.id) && !unavailable} disabled={unavailable} onChange={() => toggle(p.id)} />
                    <span>{p.label}<br /><span className="subtle-text mono">{p.file(slug)}</span>{unavailable && <span className="subtle-text"> — no sandbox run yet</span>}</span>
                  </label>
                  <span className="btn-row">
                    <button className="btn small ghost" onClick={() => setPreviewPart(p.id)} disabled={unavailable} aria-pressed={previewPart === p.id}>Preview</button>
                    <button className="btn small" disabled={unavailable} onClick={() => {
                      const content = renderPart(doc, p.id, opts);
                      if (content !== null) { downloadFile(p.file(slug), content, p.mime); done(p.id === 'project-json' ? 'Project file' : 'File'); }
                    }}>Download</button>
                  </span>
                </div>
              );
            })}
          </fieldset>
          <label className="check"><input type="checkbox" checked={prefs.includeAuthor} onChange={(e) => setPrefs({ includeAuthor: e.target.checked })} /> Include author name ({doc.passport.identity.author.trim() || 'none entered'})</label>
          <Callout tone="info" title="What will be included">
            <ul style={{ margin: 0 }}>
              <li>{started} of {STEPS.length} steps started; unfilled fields appear as “Not yet specified”.</li>
              <li>{open === 0 ? 'No open items.' : `${open} open item${open === 1 ? '' : 's'} (missing or to check).`}</li>
              <li>{run ? `Sandbox: ${describeRunStatus(run)}${stale ? ' Labelled “From earlier settings” because inputs changed.' : ''}` : 'No sandbox results.'}</li>
              <li>CSV daily rows cover the inspected first trajectory; replication rows cover all completed replications.</li>
            </ul>
          </Callout>
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="field-label">Preview: {EXPORT_PARTS.find((p) => p.id === previewPart)?.label}</p>
          {preview === null ? <p className="muted">Not available.</p> : previewPart === 'report-html' ? (
            <iframe title="HTML report preview" sandbox="" srcDoc={preview} style={{ width: '100%', height: 380, border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }} />
          ) : (
            <pre className="formula" style={{ maxHeight: 380, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} tabIndex={0}>{preview.length > 20000 ? `${preview.slice(0, 20000)}\n… (preview truncated; the file contains everything)` : preview}</pre>
          )}
        </div>
      </div>
    </Dialog>
  );
}
