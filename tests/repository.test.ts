import { describe, expect, it } from 'vitest';
import { parseProjectJson } from '../src/domain/passport/importer';
import { createProject, shortAddress, webAddress } from '../src/domain/passport/schema';
import { buildManifest } from '../src/exports/bundle';
import { passportHtml } from '../src/exports/html';
import { passportMarkdown } from '../src/exports/markdown';
import { projectJson } from '../src/exports/projectFile';

const REPO = 'https://example.org/team/helpdesk-model/tree/v1.2';

/** The project's repository: where anyone can check its data, code and project file. */
describe('repository link', () => {
  it('accepts only http and https web addresses', () => {
    expect(webAddress(REPO)).toBe(REPO);
    expect(webAddress(`  ${REPO}  `)).toBe(REPO);
    expect(webAddress('http://example.org/x')).toBe('http://example.org/x');
    for (const bad of ['', 'example.org/team', 'javascript:alert(1)', 'ftp://example.org/x', 'https://exa mple.org', 'https://localhost', `https://example.org/${'a'.repeat(500)}`, 42, null]) {
      expect(webAddress(bad), String(bad)).toBeNull();
    }
  });

  it('is shown short: host and path, without the scheme', () => {
    expect(shortAddress(REPO)).toBe('example.org/team/helpdesk-model/tree/v1.2');
    expect(shortAddress('https://example.org/')).toBe('example.org');
    expect(shortAddress(`https://example.org/${'a'.repeat(80)}`, 20)).toHaveLength(20);
  });

  it('travels in the project file as typed, even before it is a valid address', () => {
    const d = createProject();
    d.passport.identity.repository = REPO;
    const back = parseProjectJson(projectJson(d));
    expect(back.ok && back.project.passport.identity.repository).toBe(REPO);
    d.passport.identity.repository = 'example.org/half-typed';
    const half = parseProjectJson(projectJson(d));
    expect(half.ok && half.project.passport.identity.repository).toBe('example.org/half-typed');
    const raw = JSON.parse(projectJson(d));
    raw.passport.identity.repository = { href: REPO };
    const none = parseProjectJson(JSON.stringify(raw));
    expect(none.ok && none.project.passport.identity).not.toHaveProperty('repository');
  });

  it('appears in the reports and the manifest only as a valid address', () => {
    const d = createProject({ title: 'Linked' });
    d.passport.identity.repository = REPO;
    expect(passportMarkdown(d)).toContain(`Repository with the data and code: ${REPO}`);
    expect(passportHtml(d)).toContain(`<li>Repository: <a href="${REPO}" rel="noopener noreferrer">example.org/team/helpdesk-model/tree/v1.2</a></li>`);
    expect(buildManifest(d, [], '2026-11-21T00:00:00.000Z')).toMatchObject({ repository: REPO });
    d.passport.identity.repository = 'javascript:alert(1)';
    expect(passportMarkdown(d)).not.toContain('Repository');
    expect(passportHtml(d)).not.toContain('javascript:');
    expect(buildManifest(d, [], '2026-11-21T00:00:00.000Z')).not.toHaveProperty('repository');
  });

  it('a project without one says nothing about it', () => {
    const d = createProject();
    expect(passportMarkdown(d)).not.toContain('Repository');
    expect(passportHtml(d)).not.toContain('Repository:');
  });
});
