// Suppress only a fully duplicated body; preserve all distinct details and the original stored content.
export function displayPostBody(title, body) {
  const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  return normalize(title) && normalize(title) === normalize(body) ? '' : String(body || '');
}
