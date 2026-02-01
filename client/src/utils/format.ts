export function shortId(id: string, tail = 8) {
  if (!id) return "";
  return id.length <= tail ? id : `…${id.slice(-tail)}`;
}

export function formatDuration(iso?: string) {
  if (!iso) return "—";
  const matchDays = /^P(\d+)D$/i.exec(iso);
  if (matchDays) {
    const d = Number(matchDays[1]);
    return d === 1 ? "1 day" : `${d} days`;
  }
  return iso;
}

export function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}
