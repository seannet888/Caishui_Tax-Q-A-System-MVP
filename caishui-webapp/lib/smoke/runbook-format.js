export function formatList(values) {
  return values.length > 0 ? values.join(", ") : "none";
}

export function formatMissing(values) {
  return formatList(values);
}

export function unique(values) {
  return [...new Set(values)];
}
