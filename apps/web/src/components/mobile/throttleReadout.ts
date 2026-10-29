/** N1 is engine feedback, not the forward throttle-command percentage. */
export function formatN1Readout(left: number | null, right: number | null): string {
  const valid = (value: number | null): value is number =>
    value !== null && Number.isFinite(value) && value >= 0;
  if (valid(left) && valid(right)) return `${left.toFixed(1)}/${right.toFixed(1)}%`;
  if (valid(left)) return `L ${left.toFixed(1)}%`;
  if (valid(right)) return `R ${right.toFixed(1)}%`;
  return '---';
}
