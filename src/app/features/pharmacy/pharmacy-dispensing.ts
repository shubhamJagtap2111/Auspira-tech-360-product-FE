import type { DispenseLine, PharmacyStoreBalance, StockBatch } from './pharmacy.models';

export function eligibleBatches(stock: StockBatch[], medicineId: string): StockBatch[] {
  return stock.filter(batch => batch.medicineId === medicineId && batch.stockState !== 'EXPIRED' && !batch.isQuarantined && batch.availableQuantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function dispensingIssue(lines: DispenseLine[], stock: StockBatch[], balances: PharmacyStoreBalance[] = []): string | null {
  if (!lines.length) return 'This prescription has no medicines to dispense.';
  const allocated = new Map<string, number>();
  const assigned = new Map<string, number>();
  for (const line of lines) {
    if (!line.medicineId) return 'Map each prescribed medicine before dispensing.';
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) return 'Enter a valid quantity for every medicine.';
    const batch = eligibleBatches(stock, line.medicineId).find(batch => batch.batchId === line.batchId);
    if (!batch) return 'Select an available batch for each medicine. Receive stock in Stock & Batches if none is available.';
    const total = (allocated.get(batch.batchId) ?? 0) + line.quantity;
    if (total > batch.availableQuantity) return `Batch ${batch.batchNumber} has only ${batch.availableQuantity} available. Select another batch or review the quantity.`;
    allocated.set(batch.batchId, total);
    const locations = balances.filter(row => row.batchId === batch.batchId);
    if (!locations.length) continue;
    const bin = line.storeLocationId || '';
    const available = bin ? locations.find(row => row.locationId === bin)?.available ?? 0 : locations[0].unassigned;
    const key = batch.batchId + ':' + bin;
    const locationTotal = (assigned.get(key) ?? 0) + line.quantity;
    if (locationTotal > available) return 'Batch ' + batch.batchNumber + ' needs a store location with enough available stock.';
    assigned.set(key, locationTotal);
  }
  return null;
}
