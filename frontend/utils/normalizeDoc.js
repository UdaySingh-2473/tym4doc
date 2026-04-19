/**
 * Normalize a raw doctor object (from DB or local state)
 * so it always has .id (string) and .name.
 */
export function normalizeDoc(d) {
  if (!d) return d;
  const name =
    d.name ||
    (d.firstName ? `Dr. ${d.firstName} ${d.lastName || ""}`.trim() : null) ||
    d.email ||
    "Doctor";
  return {
    ...d,
    id:   String(d._id || d.id || ""),
    name,
  };
}
