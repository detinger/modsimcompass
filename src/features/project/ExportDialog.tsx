import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../../app/store';
import type { ProjectDoc } from '../../domain/passport/schema';
import { compassWarnings, STEPS, stepsStarted } from '../../domain/passport/compass';
import { buildExportZip, EXPORT_PARTS, renderPart, slugify, type ExportPart } from '../../exports/bundle';
import { reportableCopies } from '../../exports/markdown';
import { Callout, Dialog, downloadFile } from '../../ui/controls';

/**
 * Export: the project report (Markdown, HTML), the problem brief, the project file, and a ZIP with all of them.
 * Each included artefact is in the reports under its step; the ZIP can also carry each one as its own artefact file
 * with its picture.
 */
export function ExportDialog({ doc, onClose, onDownloaded }: { doc: ProjectDoc; onClose: () => void; onDownloaded: () => void }) {
  const { prefs, setPrefs, toast } = useStore();
  const copies = reportableCopies(doc);
  const [selected, setSelected] = useState<ExportPart[]>(['passport-md', 'project-json', 'report-html']);
  const [withArtefacts, setWithArtefacts] = useState(true);
  const [previewPart, setPreviewPart] = useState<ExportPart>('report-html');
  const opts = { includeAuthor: prefs.includeAuthor, generatedAt: new Date().toISOString(), includeArtefacts: withArtefacts };
  const slug = slugify(doc.passport.identity.title);
  const preview = useMemo(() => renderPart(doc, previewPart, opts), [doc, previewPart, prefs.includeAuthor]); // eslint-disable-line react-hooks/exhaustive-deps
  const started = stepsStarted(doc.passport, copies).length;
  const open = compassWarnings(doc).filter((w) => w.severity !== 'tip').length;
  const toggle = (id: ExportPart) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const done = (what: string) => { onDownloaded(); toast(`${what} generated. Use your browser download to save it.`, 'success'); };
  const extra = copies.length > 0 && withArtefacts ? copies.length : 0;
  return (
    <Dialog title="Export project" onClose={onClose}
      actions={<>
        <button type="button" className="btn" onClick={onClose}>Close</button>
        <button type="button" className="btn primary" disabled={selected.length === 0} onClick={() => {
          downloadFile(`${slug}-modsim-export.zip`, buildExportZip(doc, selected, opts), 'application/zip');
          done('ZIP file');
        }}><Download size={16} aria-hidden="true" /> Download ZIP ({selected.length + extra} file{selected.length + extra === 1 ? '' : 's'} + manifest)</button>
      </>}>
      <p className="muted">Files are saved on this device only. Nothing is uploaded.</p>
      <div className="split">
        <div>
          <fieldset>
            <legend>Include</legend>
            {EXPORT_PARTS.map((p) => (
              <div key={p.id} className="export-row">
                <label className="check">
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                  <span>{p.label}<br /><span className="subtle-text mono">{p.file(slug)}</span></span>
                </label>
                <span className="btn-row">
                  <button type="button" className="btn small ghost" onClick={() => setPreviewPart(p.id)} aria-pressed={previewPart === p.id}>Preview<span className="sr-only"> {p.label}</span></button>
                  <button type="button" className="btn small" onClick={() => {
                    const content = renderPart(doc, p.id, opts);
                    if (content !== null) { downloadFile(p.file(slug), content, p.mime); done(p.id === 'project-json' ? 'Project file' : 'File'); }
                  }}>Download<span className="sr-only"> {p.label}</span></button>
                </span>
              </div>
            ))}
            {copies.length > 0 && (
              <div className="export-row">
                <label className="check">
                  <input type="checkbox" checked={withArtefacts} onChange={(e) => setWithArtefacts(e.target.checked)} />
                  <span>Each artefact as its own file, with its picture (ZIP only)<br /><span className="subtle-text mono">artefacts/ · figures/</span></span>
                </label>
              </div>
            )}
          </fieldset>
          <label className="check"><input type="checkbox" checked={prefs.includeAuthor} onChange={(e) => setPrefs({ includeAuthor: e.target.checked })} /> Include author name ({doc.passport.identity.author.trim() || 'none entered'})</label>
          <Callout tone="info" title="In the report">
            <ul style={{ margin: 0 }}>
              <li>{started} of {STEPS.length} steps started. Empty fields read “Not yet specified”.</li>
              <li>{copies.length === 0 ? 'No artefacts.' : `${copies.length} artefact${copies.length === 1 ? '' : 's'}, each under its step.`}</li>
              <li>{open === 0 ? 'No open items.' : `${open} open item${open === 1 ? '' : 's'} (missing or to check).`}</li>
            </ul>
          </Callout>
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="field-label">Preview: {EXPORT_PARTS.find((p) => p.id === previewPart)?.label}</p>
          {preview === null ? <p className="muted">Not available.</p> : previewPart === 'report-html' ? (
            <iframe title="HTML report preview" sandbox="" srcDoc={preview} style={{ width: '100%', height: 380, border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }} />
          ) : (
            <pre className="formula" style={{ maxHeight: 380, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} tabIndex={0} aria-label="Preview">{preview.length > 20000 ? `${preview.slice(0, 20000)}\n… (preview shortened; the file has everything)` : preview}</pre>
          )}
        </div>
      </div>
    </Dialog>
  );
}
