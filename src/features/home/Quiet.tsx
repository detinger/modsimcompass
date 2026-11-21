import { Component, type ReactNode } from 'react';

/** Keeps a decorative block (such as a lazily loaded diagram) from taking the whole page down if it fails. */
export class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
