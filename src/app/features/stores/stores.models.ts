export type StoreRow = Record<string, unknown>;
export interface StoreField {
  key: string;
  label: string;
  type?: 'number' | 'date' | 'datetime-local' | 'textarea' | 'checkbox';
  source?: string;
  choices?: string[];
  optional?: boolean;
}
export interface StoreForm {
  key: string;
  tab: string;
  title: string;
  permission: string;
  path: string;
  fields: StoreField[];
  versionFrom?: string;
  versionKey?: string;
  revisionField?: string;
  bodyVersionField?: string;
  inspectedReceipt?: boolean;
  states?: string[];
  fixed?: StoreRow;
}

export const select = (key: string, label: string, source: string, optional = false): StoreField => ({ key, label, source, optional });
export const field = (key: string, label: string, type?: StoreField['type'], optional = false): StoreField => ({ key, label, type, optional });
export const choice = (key: string, label: string, choices: string[]): StoreField => ({ key, label, choices });
export const reason = field('reason', 'Reason and supporting evidence', 'textarea');
const quantity = field('quantity', 'Quantity', 'number');
const location = select('locationId', 'Store location', 'locations');
const lot = select('lotId', 'Lot or batch', 'lots');
const item = select('itemId', 'Inventory item', 'items');
const reference = field('reference', 'Reference');
const procurementForms: StoreForm[] = [
  { key: 'requisition', tab: 'purchasing', title: 'Request a purchase', permission: 'Stores.Request', path: '/stores/requisitions',
    fields: [item, quantity, reason] },
  { key: 'quote', tab: 'purchasing', title: 'Record a supplier quotation', permission: 'Stores.Request', path: '/stores/quotes',
    fields: [select('requisitionId', 'Requisition', 'requisitions'), select('vendorId', 'Supplier', 'vendors'), reference,
      field('rate', 'Unit rate', 'number'), field('validUntil', 'Valid until', 'date')] },
  { key: 'award', tab: 'purchasing', title: 'Approve quote and issue purchase order', permission: 'Stores.Approve', path: '/stores/awards',
    fields: [select('quoteId', 'Supplier quotation', 'quotes'), reason] },
  { key: 'match', tab: 'purchasing', title: 'Match supplier invoice to received stock', permission: 'Stores.Approve', path: '/stores/invoice-matches',
    fields: [select('orderId', 'Received purchase order', 'purchaseOrders'), select('itemId', 'Received item', 'orderItems'),
      reference, quantity, field('amount', 'Invoice line amount', 'number'),select('exceptionId','Approved invoice exception','invoiceExceptions',true), reason] },
  { key: 'supplierReturn', tab: 'purchasing', title: 'Record a verified supplier return', permission: 'Stores.Approve', path: '/stores/supplier-returns',
    fields: [lot, location, quantity, reason] },
  { key: 'count', tab: 'stock', title: 'Record physical general stock count', permission: 'Stores.Move', path: '/stores/counts',
    fields: [lot, location, field('observed', 'Observed stock', 'number'), reason] },
  ...[true, false].map(approved => ({
    key: approved ? 'approveCount' : 'rejectCount', tab: 'stock', title: approved ? 'Approve stock count adjustment' : 'Reject stock count',
    permission: 'Stores.Approve', path: '/stores/count-reviews', fixed: { approved },
    fields: [select('countId', 'Stock count', 'counts'), reason]
  })),
  { key: 'equipmentJob', tab: 'equipment', title: 'Open equipment work order', permission: 'Stores.Equipment', path: '/stores/equipment/jobs',
    fields: [select('assetId', 'Registered asset', 'assets'), choice('kind', 'Work order type', ['MAINTENANCE', 'CALIBRATION', 'REPAIR', 'RETIREMENT']), reference, reason] },
  { key: 'releaseEquipment', tab: 'equipment', title: 'Review service evidence and release asset', permission: 'Stores.Equipment', path: '/stores/equipment/releases',
    fields: [select('jobId', 'Open work order', 'equipmentJobs'), field('nextDue', 'Next service due', 'date'), reference, reason] }
];


const equipmentLinkForms: StoreForm[] = [
  { key: 'labLink', tab: 'equipment', title: 'Link laboratory reference adapter', permission: 'Stores.Equipment', path: '/stores/equipment/device-links',
    fixed: { kind: 'LAB_REFERENCE' }, fields: [select('assetId', 'Registered asset', 'assets'), select('labDeviceId', 'Reference device', 'labDevices'),
      select('mappingVersion', 'Registered mapping version', 'labMappings'), field('interfaceReference', 'Interface document reference'), reason] },
  { key: 'imagingLink', tab: 'equipment', title: 'Link imaging interface profile', permission: 'Stores.Equipment', path: '/stores/equipment/device-links',
    fixed: { kind: 'IMAGING' }, fields: [select('assetId', 'Registered asset', 'assets'), select('imagingProfileId', 'Radiology profile', 'imagingProfiles'),
      field('interfaceReference', 'Conformance document reference'), reason] },
  { key: 'otLink', tab: 'equipment', title: 'Link theatre device configuration', permission: 'Stores.Equipment', path: '/stores/equipment/device-links',
    fixed: { kind: 'OT' }, fields: [select('assetId', 'Registered asset', 'assets'), select('otDeviceId', 'Theatre device profile', 'otDevices'),
      field('interfaceReference', 'Interface document reference'), reason] },
  { key: 'manualLink', tab: 'equipment', title: 'Register manual dialysis reference workflow', permission: 'Stores.Equipment', path: '/stores/equipment/device-links',
    fixed: { kind: 'DIALYSIS_MANUAL' }, fields: [select('assetId', 'Registered asset', 'assets'),
      field('interfaceReference', 'Manual workflow reference'), reason] },
  ...[true, false].map(verified => ({
    key: verified ? 'deviceCheck' : 'deviceReview', tab: 'equipment', title: verified ? 'Record independent reference check' : 'Record interface issue for review',
    permission: 'Stores.Equipment', path: '/stores/equipment/device-checks', fixed: { verified },
    fields: [select('linkId', 'Asset interface registration', 'deviceLinks'), select('referenceRunId','Executed laboratory reference run','deviceReferenceRuns',true), field('evidence', 'Test or issue reference'), reason]
  }))
];

const policyForms: StoreForm[] = [
  { key: 'stockPolicy', tab: 'configuration', title: 'Set reviewed stock handling policy', permission: 'Stores.Configure', path: '/stores/stock-policies',
    versionFrom: 'lots', revisionField: 'lotId', fields: [lot, field('controlled', 'Independent custody required', 'checkbox'),
      field('enforceFefo', 'Require expiry-first selection', 'checkbox'), field('minimumCelsius', 'Minimum °C from hospital policy', 'number', true),
      field('maximumCelsius', 'Maximum °C from hospital policy', 'number', true), reference, reason] },
  { key: 'temperature', tab: 'stock', title: 'Record temperature evidence', permission: 'Stores.Move', path: '/stores/temperatures',
    fields: [lot, field('measuredAt', 'Measured at', 'datetime-local'), field('valueCelsius', 'Measured °C', 'number'), reference, reason] },
  { key: 'temperatureReview', tab: 'stock', title: 'Review temperature excursion', permission: 'Stores.Approve', path: '/stores/temperature-reviews',
    fields: [select('sampleId', 'Temperature excursion', 'temperatures'), choice('disposition', 'Disposition', ['RELEASE', 'REJECT']), reason] },
  { key: 'custody', tab: 'stock', title: 'Request controlled-stock or expiry exception authorization', permission: 'Stores.Move', path: '/stores/custody-requests',
    fields: [lot, location, quantity, field('expiresAt', 'Authorization expiry', 'datetime-local'), field('exceptionReason', 'Expiry exception evidence', 'textarea', true), reason] },
  ...[true,false].map(approved => ({ key: approved ? 'custodyApprove' : 'custodyReject', tab: 'stock', title: approved ? 'Approve custody request' : 'Reject custody request',
    permission: 'Stores.Approve', path: '/stores/custody-reviews', fixed: { approved }, fields: [select('requestId', 'Pending request', 'custodyRequests'), reason] })),
  { key: 'reorder', tab: 'configuration', title: 'Set location reorder levels', permission: 'Stores.Configure', path: '/stores/reorder-policies',
    fields: [lot, location, field('minimum', 'Minimum available', 'number'), field('target', 'Target quantity', 'number'), reason] },
  { key: 'discrepancy', tab: 'transfers', title: 'Report transfer discrepancy', permission: 'Stores.Move', path: '/stores/transfer-discrepancies',
    versionFrom: 'transfers', bodyVersionField: 'transferId', fields: [select('transferId','In-transit transfer','transfers'),quantity,reason] },
  { key: 'resolveTransfer', tab: 'transfers', title: 'Resolve witnessed transfer discrepancy', permission: 'Stores.Approve', path: '/stores/transfer-resolutions',
    fields: [select('discrepancyId', 'Open discrepancy', 'transferDiscrepancies'), choice('action', 'Verified disposition', ['RECEIVED_ON_HOLD','VERIFIED_LOSS']), reason] }
];

export const storeForms: StoreForm[] = [
  ...policyForms,
  {key:'deviceReference',tab:'equipment',title:'Run laboratory adapter reference checks',permission:'Stores.Equipment',path:'/stores/equipment/reference-runs',
    fields:[select('linkId','Registered laboratory reference adapter','deviceLinks'),field('samplePayload','Reference HL7 ORU sample','textarea'),reason]},
  {key:'withdrawDevice',tab:'equipment',title:'Withdraw device interface and place equipment on hold',permission:'Stores.Equipment',path:'/stores/equipment/withdrawals',
    fields:[select('linkId','Registered interface','deviceLinks'),reason]},
  {key:'locationPolicy',tab:'configuration',title:'Set location ownership and access',permission:'Stores.Configure',path:'/stores/location-policies',
    fields:[location,field('restricted','Restrict stock movements to assigned staff','checkbox'),select('managerId','Location manager','custodians'),reason]},
  {key:'locationMember',tab:'configuration',title:'Assign or revoke location stock access',permission:'Stores.Configure',path:'/stores/location-members',
    fields:[location,select('userId','Staff member','custodians'),field('allowed','Allow location stock movements','checkbox'),reason]},
  {key:'generalReturn',tab:'stock',title:'Verify unused general stock return',permission:'Stores.Approve',path:'/stores/issue-returns',
    fields:[select('issueId','Original location issue','generalIssues'),quantity,reason]},
  {key:'reconciliation',tab:'configuration',title:'Sign location stock reconciliation',permission:'Stores.Approve',path:'/stores/reconciliation-reviews',fields:[reason]},
  { key: 'purchasingPolicy', tab: 'configuration', title: 'Set purchasing approval and tolerance policy', permission: 'Stores.Configure', path: '/stores/purchasing-policies',
    fields: [field('revision','Current policy revision','number'),field('awardLimit','Maximum approval amount','number'),
      field('requiredQuotes','Required distinct supplier quotations','number'),field('invoiceTolerancePercent','Invoice exception tolerance %','number'),
      field('exceptionLimit','Maximum exception value','number'),reference,reason] },
  { key: 'inspection', tab: 'purchasing', title: 'Inspect delivered purchase stock', permission: 'Stores.Move', path: '/stores/receipt-inspections',
    fields: [select('orderId','Open purchase order','openOrders'),select('lineId','Purchase order line','openOrderLines'),
      field('delivered','Delivered quantity','number'),field('accepted','Accepted quantity','number'),field('rejected','Rejected or excess quantity','number'),
      field('damaged','Damaged quantity','number'),reference,reason] },
  { key: 'receiveInspected', tab: 'purchasing', title: 'Receive inspected accepted stock', permission: 'Inventory.Edit',
    path: '/inventory/purchase-orders/{orderId}/receive', inspectedReceipt: true,
    fields: [select('orderId','Open purchase order','openOrders'),select('lineId','Purchase order line','openOrderLines'),
      select('inspectionId','Recorded inspection','receiptInspections'),quantity,field('notes','Receiving notes','textarea')] },
  { key: 'invoiceException', tab: 'purchasing', title: 'Request invoice tolerance exception', permission: 'Stores.Request', path: '/stores/invoice-exceptions',
    fields: [select('orderId','Received purchase order','purchaseOrders'),select('itemId','Received item','orderItems'),reference,quantity,
      field('amount','Invoice line amount','number'),reason] },
  ...[true,false].map(approved=>({key:approved?'invoiceExceptionApprove':'invoiceExceptionReject',tab:'purchasing',
    title:approved?'Approve invoice exception':'Reject invoice exception',permission:'Stores.Approve',path:'/stores/invoice-exception-reviews',
    fixed:{approved},fields:[select('exceptionId','Invoice exception','invoiceExceptions'),reason]})),
  { key: 'supplierCredit', tab: 'purchasing', title: 'Request supplier credit note', permission: 'Stores.Request', path: '/stores/supplier-credits',
    fields: [select('invoiceId','Matched supplier invoice','payables'),reference,quantity,field('amount','Credit amount','number'),reason] },
  ...[true,false].map(approved=>({key:approved?'creditApprove':'creditReject',tab:'purchasing',
    title:approved?'Approve supplier credit':'Reject supplier credit',permission:'Stores.Approve',path:'/stores/supplier-credit-reviews',
    fixed:{approved},fields:[select('requestId','Supplier credit note','supplierCredits'),reason]})),
  ...[true,false].map(accepted=>({key:accepted?'payableApprove':'payableReject',tab:'purchasing',
    title:accepted?'Approve payable handoff':'Reject payable handoff',permission:'Stores.Approve',path:'/stores/payable-reviews',
    fixed:{accepted},fields:[select('invoiceId','Matched supplier invoice','payables'),reference,reason]})),
  { key:'assetDetails',tab:'equipment',title:'Register equipment identity and custodian',permission:'Stores.Equipment',path:'/stores/equipment/details',
    versionFrom:'assets',revisionField:'assetId',fields:[select('assetId','Asset','assets'),field('manufacturer','Manufacturer'),field('model','Model'),
      select('custodianId','Named custodian','custodians'),field('warrantyUntil','Warranty until','date',true),field('location','Physical location'),reference,reason] },
  { key:'serviceAgreement',tab:'equipment',title:'Register service agreement',permission:'Stores.Equipment',path:'/stores/equipment/agreements',
    fields:[select('assetId','Asset','assets'),select('vendorId','Service supplier','vendors'),reference,field('startsOn','Starts on','date'),
      field('endsOn','Ends on','date'),field('responseHours','Agreed response hours','number'),field('terms','Agreement terms','textarea')] },
  { key:'imagingAsset',tab:'equipment',title:'Link imaging room to physical equipment',permission:'Stores.Equipment',path:'/stores/equipment/imaging-links',
    fields:[select('roomId','Imaging room','imagingRooms'),select('assetId','Physical imaging asset','assets'),reason] },
  ...procurementForms,
  ...equipmentLinkForms,
  { key: 'location', tab: 'configuration', title: 'Register store location', permission: 'Stores.Configure', path: '/stores/locations',
    fields: [field('code', 'Store code'), field('name', 'Store name'), choice('kind', 'Store type', ['GENERAL', 'PHARMACY']), select('parentId', 'Parent store', 'locations', true)] },
  { key: 'allocate', tab: 'stock', title: 'Allocate existing general stock', permission: 'Stores.Configure', path: '/stores/allocations',
    fields: [location, select('itemId', 'Inventory item', 'items'), select('receiptId', 'Source receipt', 'receipts', true), field('lotNumber', 'Lot reference'), field('expiresOn', 'Expiry date', 'date', true), field('serialNumber', 'Serial number', undefined, true), quantity, reason] },
  { key: 'batch', tab: 'stock', title: 'Allocate existing pharmacy batch', permission: 'Stores.Configure', path: '/stores/allocations', fixed: { lotNumber: '' },
    fields: [location, select('batchId', 'Registered pharmacy batch', 'batches'), quantity, reason] },
  { key: 'issue', tab: 'stock', title: 'Issue general stock from location', permission: 'Stores.Move', path: '/stores/issues', fields: [lot, location, quantity, select('departmentId','Receiving department','departments',true), reason] },
  { key: 'hold', tab: 'stock', title: 'Place lot on hold', permission: 'Stores.Approve', path: '/stores/lots/{lotId}/hold', fixed: { held: true }, fields: [lot, reason] },
  { key: 'release', tab: 'stock', title: 'Release reviewed lot hold', permission: 'Stores.Approve', path: '/stores/lots/{lotId}/hold', fixed: { held: false }, fields: [lot, reason] },
  { key: 'request', tab: 'transfers', title: 'Request store transfer', permission: 'Stores.Request', path: '/stores/transfers',
    fields: [lot, select('sourceId', 'Dispatch location', 'locations'), select('destinationId', 'Receiving location', 'locations'), quantity, reason] },
  ...['APPROVE', 'DISPATCH', 'RECEIVE', 'CANCEL', 'RETURN'].map(action => ({
    key: action.toLowerCase(), tab: 'transfers', title: ({ APPROVE: 'Approve and reserve', DISPATCH: 'Dispatch reserved stock', RECEIVE: 'Receive stock', CANCEL: 'Cancel before dispatch', RETURN: 'Confirm remainder returned to source' } as Record<string,string>)[action],
    permission: ['APPROVE','CANCEL','RETURN'].includes(action) ? 'Stores.Approve' : 'Stores.Move', path: '/stores/transfers/{transferId}/actions', versionFrom: 'transfers', fixed: { action },
    fields: [select('transferId', 'Transfer', 'transfers'), ...(action === 'RECEIVE' ? [quantity] : []), reason]
  }))
];

export function storeCommand(form: StoreForm, values: StoreRow, records: StoreRow[]) {
  const body: StoreRow = { ...form.fixed };
  for (const input of form.fields) {
    const value = input.type === 'checkbox' ? (values[input.key] ?? false) : values[input.key];
    if (value == null || String(value).trim() === '') {
      if (!input.optional) throw new Error(`${input.label} is required.`);
      body[input.key] = null;
      continue;
    }
    if (input.type === 'checkbox') {
      body[input.key] = value === true || value === 'true';
    } else if (input.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number) || (number < 0 && !['valueCelsius', 'minimumCelsius', 'maximumCelsius'].includes(input.key)) || (input.key === 'quantity' && number === 0))
        throw new Error(`${input.label} must be a valid quantity.`);
      body[input.key] = number;
    } else if (input.type === 'datetime-local') {
      const date = new Date(String(value));
      if (!Number.isFinite(date.getTime())) throw new Error(`${input.label} must be a valid time.`);
      body[input.key] = date.toISOString();
    } else body[input.key] = String(value).trim();
  }
  if (form.revisionField) {
    const record = records.find(row => row['id'] === body[form.revisionField!]);
    if (!record || typeof record['revision'] !== 'number') throw new Error('Refresh and choose a current episode.');
    body['revision'] = record['revision'];
  }
  if (form.bodyVersionField) {
    const record = records.find(row => row['id'] === body[form.bodyVersionField!]);
    if (!record || typeof record['version'] !== 'number') throw new Error('Refresh and choose a current record.');
    body['version'] = record['version'];
  }
  const path = form.path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const id = String(body[key] ?? '');
    if (!id) throw new Error('Select a record first.');
    if (form.versionFrom && (!form.versionKey || form.versionKey === key)) {
      const record = records.find(row => row['id'] === id);
      if (!record || typeof record['version'] !== 'number') throw new Error('Refresh and choose a current record.');
      body['version'] = record['version'];
    }
    delete body[key];
    return encodeURIComponent(id);
  });
  return { path, body };
}
