/** Remembers the project step the user came from, so a tool can offer the way back. In memory only. */
let origin: { path: string; label: string } | null = null;
export const rememberOrigin = (path: string, label: string) => { origin = { path, label }; };
export const cameFrom = () => origin;
