// Presentation only: keep API state values unchanged for clinical workflow actions.
export function workspaceStateLabel(value: string): string {
  const labels: Record<string, string> = {
    LAB: 'Laboratory', IMAGING: 'Imaging', PROCEDURE: 'Procedures', PHARMACY: 'Pharmacy',
    DIRECT: 'Direct request', PRESCRIPTION: 'Prescription', STAT: 'STAT',
    STAGED: 'Awaiting review', DEAD: 'Needs recovery', LEASED: 'Delivering'
  };
  return labels[value] ?? value.replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase());
}

export function workspaceBadgeClass(value: string): string {
  const tone = ['COMPLETED', 'DELIVERED', 'ACCEPTED', 'RELEASED', 'SIGNED', 'GIVEN', 'DONE', 'PUBLISHED', 'WITNESSED'].includes(value) ? 'success'
    : ['CANCELLED', 'REJECTED', 'DEAD', 'STAT', 'URGENT'].includes(value) ? 'error'
    : ['QUARANTINED', 'PENDING', 'STAGED', 'SUSPENDED', 'HELD', 'ON_HOLD', 'PRELIMINARY', 'DUE', 'AWAITING_WITNESS'].includes(value) ? 'warning' : 'primary';
  return `ac-badge ac-badge-${tone}`;
}
