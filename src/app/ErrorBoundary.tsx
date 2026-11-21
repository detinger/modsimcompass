import { Component, type ErrorInfo, type ReactNode } from 'react';
import { projectJson, slugify } from '../exports/bundle';
import type { ProjectDoc } from '../domain/passport/schema';
import { downloadFile } from '../ui/controls';

interface Props { children: ReactNode; /** Changing this (the address) clears the error, so navigation recovers the screen. */ resetKey: string; project: ProjectDoc | null }

/**
 * Keeps one broken screen from blanking the whole app. The navigation stays usable, and the open project
 * can still be downloaded as a file, so nothing is lost while the problem is looked at.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) { return { error }; }
  static getDerivedStateFromProps(props: Props, state: { error: Error | null; key: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Screen failed to render', error, info.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    const p = this.props.project;
    return (
      <div className="page" role="alert" style={{ maxWidth: 640 }}>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>This screen could not be shown</h1>
          <p>Something in this view failed. Your project is still stored on this device.</p>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>Reload</button>
            <a className="btn" href="/">Go to Home</a>
            {p && <button type="button" className="btn" onClick={() => downloadFile(`${slugify(p.passport.identity.title)}.modsim.json`, projectJson(p), 'application/json')}>Download project file</button>}
          </div>
          <details style={{ marginTop: 12 }}><summary>Technical detail</summary><pre className="formula" style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error.message || this.state.error)}</pre></details>
        </div>
      </div>
    );
  }
}
