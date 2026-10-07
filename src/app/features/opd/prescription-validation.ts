import type { OpdPrescriptionItemForm } from './opd-management.models';

export function parsePrescriptionDuration(value: string): number | null {
  const match = String(value ?? '').trim().match(/^(\d+)\s*(?:days?|d)?$/i);
  const days = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(days) && days > 0 ? days : null;
}

export function parsePrescriptionQuantity(value: string): number | null {
  const match = String(value ?? '').trim().match(/^(\d+(?:\.\d*)?|\.\d+)\s*(?:tablets?|tabs?|capsules?|caps?|ml|units?|bottles?|packs?|puffs?|doses?|sachets?|vials?|ampoules?|drops?|pieces?)?$/i);
  const quantity = match ? Number(match[1]) : 0;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

export function isAsNeededPrescription(item: OpdPrescriptionItemForm): boolean {
  return Boolean(item.isPrn) || /^(as\s+needed|prn|sos)$/i.test(item.frequency?.trim() ?? '');
}

export function prescriptionItemIssues(item: OpdPrescriptionItemForm, requireCatalog = true): string[] {
  const issues: string[] = [];
  if (!item.medicine?.trim()) issues.push('Medicine name');
  if (requireCatalog && !item.medicineId) issues.push('Catalog medicine selection');
  if (!item.dosage?.trim()) issues.push('Dosage');
  if (!item.route?.trim()) issues.push('Route');
  if (!item.frequency?.trim()) issues.push('Frequency');
  if (parsePrescriptionDuration(item.duration) === null) issues.push('Duration (positive whole days)');
  if (parsePrescriptionQuantity(item.quantity) === null) issues.push('Quantity (greater than zero)');
  if (isAsNeededPrescription(item) && !item.prnReason?.trim()) issues.push('As-needed indication');
  return issues;
}
