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
