export async function shareInvite(username: string, text: string, copied: () => void) {
  const url = `${location.origin}/#/invite/${username}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'inner', text, url });
      return;
    }
  } catch {
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    copied();
  } catch {
    prompt('', url);
  }
}

export function seenStories(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('inner.seen') || '[]'));
  } catch {
    return new Set();
  }
}

export function markSeen(ids: string[]) {
  const s = seenStories();
  ids.forEach((id) => s.add(id));
  try {
    localStorage.setItem('inner.seen', JSON.stringify(Array.from(s).slice(-500)));
  } catch {}
}
