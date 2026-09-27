import type { DispenseLine, StockBatch } from './pharmacy.models';

export function eligibleBatches(stock: StockBatch[], medicineId: string): StockBatch[] {
  return stock.filter(batch => batch.medicineId === medicineId && batch.stockState !== 'EXPIRED' && !batch.isQuarantined && batch.availableQuantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function dispensingIssue(lines: DispenseLine[], stock: StockBatch[]): string | null {
  if (!lines.length) return 'This prescription has no medicines to dispense.';
  const allocated = new Map<string, number>();
  for (const line of lines) {
    if (!line.medicineId) return 'Map each prescribed medicine before dispensing.';
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) return 'Enter a valid quantity for every medicine.';
    const batch = eligibleBatches(stock, line.medicineId).find(batch => batch.batchId === line.batchId);
    if (!batch) return 'Select an available batch for each medicine. Receive stock in Stock & Batches if none is available.';
    const total = (allocated.get(batch.batchId) ?? 0) + line.quantity;
    if (total > batch.availableQuantity) return `Batch ${batch.batchNumber} has only ${batch.availableQuantity} available. Select another batch or review the quantity.`;
    allocated.set(batch.batchId, total);
  }
  return null;
}
