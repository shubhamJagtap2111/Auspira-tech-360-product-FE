// Isolated production-bundle preview. Every API request uses synthetic data on localhost.
// Usage: node tests/ipd-preview.cjs, then open the printed /fixture URL.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve('dist/auspira-care360-web/browser');
const now = new Date().toISOString();
const permissions = [...fs.readFileSync('src/app/app.routes.ts', 'utf8').matchAll(/permission: '([^']+)'/g)].map(match => match[1]);
const session = { userId: 'ipd-fixture', email: 'staff@example.test', fullName: 'IPD Preview Staff', accessToken: 'synthetic-token', refreshToken: 'synthetic-token', accessTokenExpiresAt: '2099-01-01T00:00:00Z', permissions, roleCodes: ['HOSPITAL_ADMIN'], menuItems: [], hospitalName: 'Synthetic Hospital', tenantCode: 'preview' };
const basePatient = { admissionNo: 'IP-001', patientId: 'patient-1', patientName: 'Sample Patient One', medicalRecordNo: 'SAMPLE-001', doctorId: 'doctor-1', doctorName: 'Dr. Sample', departmentName: 'General Medicine', wardName: 'General Ward', roomNumber: '101', bedNo: 'G-01', admittedAt: now, statusCode: 'ADMITTED', admissionSource: 'OPD', admissionType: 'GENERAL', admissionReason: 'Observation following assessment', primaryDiagnosis: 'Recorded admission diagnosis', knownAllergies: 'Example allergen', bloodGroup: 'O+', priorityCode: 'ROUTINE', stayDays: 2, outstanding: 1200, activeOrders: 2 };
const patients = [
  { ...basePatient, admissionId: 'stay-1' },
  { ...basePatient, admissionId: 'stay-2', patientId: 'patient-2', patientName: 'Sample Patient Two', admissionNo: 'IP-002', medicalRecordNo: 'SAMPLE-002', bedNo: '', wardName: '', roomNumber: '', knownAllergies: '', priorityCode: 'URGENT', activeOrders: 0, outstanding: 0 },
  { ...basePatient, admissionId: 'stay-3', patientId: 'patient-3', patientName: 'Sample Patient Three', admissionNo: 'IP-003', medicalRecordNo: 'SAMPLE-003', bedNo: 'G-02', knownAllergies: '', statusCode: 'DISCHARGE_INITIATED', activeOrders: 0, outstanding: 500 },
  { ...basePatient, admissionId: 'stay-4', patientId: 'patient-4', patientName: 'Sample Patient Four', admissionNo: 'IP-004', medicalRecordNo: 'SAMPLE-004', bedNo: 'P-01', wardName: 'Private Ward', roomNumber: '201', knownAllergies: '', activeOrders: 0 }
];
const beds = [
  { bedId: 'bed-1', wardId: 'ward-1', roomId: 'room-1', wardName: 'General Ward', roomNumber: '101', bedNo: 'G-01', bedType: 'STANDARD', statusCode: 'OCCUPIED', dailyCharge: 500, currentPatientName: patients[0].patientName, admissionId: 'stay-1' },
  { bedId: 'bed-2', wardId: 'ward-1', roomId: 'room-1', wardName: 'General Ward', roomNumber: '101', bedNo: 'G-02', bedType: 'STANDARD', statusCode: 'OCCUPIED', dailyCharge: 500, currentPatientName: patients[2].patientName, admissionId: 'stay-3' },
  { bedId: 'bed-3', wardId: 'ward-1', roomId: 'room-1', wardName: 'General Ward', roomNumber: '102', bedNo: 'G-03', bedType: 'STANDARD', statusCode: 'AVAILABLE', dailyCharge: 500, currentPatientName: '', admissionId: null },
  { bedId: 'bed-4', wardId: 'ward-1', roomId: 'room-1', wardName: 'General Ward', roomNumber: '102', bedNo: 'G-04', bedType: 'STANDARD', statusCode: 'CLEANING', dailyCharge: 500, currentPatientName: '', admissionId: null },
  { bedId: 'bed-5', wardId: 'ward-2', roomId: 'room-2', wardName: 'Private Ward', roomNumber: '201', bedNo: 'P-01', bedType: 'STANDARD', statusCode: 'OCCUPIED', dailyCharge: 1200, currentPatientName: patients[3].patientName, admissionId: 'stay-4' }
];
const rounds = new Map(), vitals = new Map(), drafts = new Map();
rounds.set('stay-1', [{ roundId: 'round-1', admissionId: 'stay-1', doctorId: 'doctor-1', doctorName: 'Dr. Sample', roundAt: now, patientCondition: 'STABLE', patientConditionName: 'Stable', clinicalNotes: 'Synthetic round note for UI verification.', treatmentPlan: 'Recorded plan for sample stay.', diagnosisUpdate: '', medicationChanges: '', investigationOrders: '', procedureRecommendation: '', followUpInstructions: '', nextRoundAt: null, createdAt: now }]);
vitals.set('stay-1', [{ vitalId: 'vital-1', admissionId: 'stay-1', recordedAt: now, temperature: 98.6, pulseRate: 76, respiratoryRate: 18, bloodPressureSystolic: 120, bloodPressureDiastolic: 80, spo2: 98, height: null, weight: null, painScore: null, bloodGlucose: null, notes: 'Synthetic observation', recordedBy: 'Sample nurse', createdAt: now }]);
function dashboard(empty) {
  const active = empty ? [] : patients.filter(patient => patient.statusCode !== 'DISCHARGED');
  const wards = ['General Ward', 'Private Ward'].map((wardName, index) => {
    const wardBeds = beds.filter(bed => bed.wardName === wardName);
    const availableBeds = wardBeds.filter(bed => bed.statusCode === 'AVAILABLE').length;
    const occupiedBeds = wardBeds.filter(bed => bed.statusCode === 'OCCUPIED').length;
    return { wardId: 'ward-' + (index + 1), wardName, wardCode: 'W' + index, wardType: 'GENERAL', department: 'General Medicine', floor: 'Ground', capacity: wardBeds.length, statusCode: 'ACTIVE', description: '', branchName: 'Main', totalBeds: wardBeds.length, availableBeds, occupiedBeds, occupancyPercent: occupiedBeds / wardBeds.length * 100 };
  });
  return { summary: { currentAdmissions: active.length, availableBeds: beds.filter(bed => bed.statusCode === 'AVAILABLE').length, occupiedBeds: beds.filter(bed => bed.statusCode === 'OCCUPIED').length, totalBeds: beds.length, occupancyPercent: 60, admissionsToday: active.length, dischargesToday: patients.length - active.length }, wards, rooms: [{ roomId: 'room-1', wardId: 'ward-1', wardName: 'General Ward', roomNumber: '101', roomType: 'GENERAL', floor: 'Ground', capacity: 4, statusCode: 'ACTIVE', totalBeds: 4, availableBeds: 1, occupiedBeds: 2 }], admissions: empty ? [] : patients, recentAdmissions: active, activePatients: active, beds, attentionItems: [], patients: patients.map(patient => ({ value: patient.patientId, label: patient.patientName, meta: patient.medicalRecordNo })), doctors: [{ value: 'doctor-1', label: 'Dr. Sample', meta: 'General Medicine', departmentName: 'General Medicine' }], generatedAt: now };
}
const writes = [];
const notifications = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'");
  if (url.pathname === '/fixture') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<script>localStorage.clear();localStorage.setItem('care360.auth.session',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('care360.selectedBranchCode','MAIN');document.cookie='ipd-empty=${url.searchParams.has('empty')};path=/';location.replace('/ipd');</script>`);
  }
  if (url.pathname === '/fixture-writes') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(writes)); }
  // Add an alert to the local fixture, then let the app's normal poll discover it.
  if (url.pathname === '/fixture-notification' && req.method === 'POST') {
    notifications.unshift({ id: 'sample-' + Date.now(), branchCode: 'MAIN', module: 'IPD', priority: url.searchParams.has('critical') ? 'CRITICAL' : 'INFO', title: 'Sample ward update received', message: 'Synthetic notification for visual verification.', actionUrl: '/ipd', createdAt: new Date().toISOString(), readAt: null });
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ added: true }));
  }
  if (url.pathname.includes('/api/v1/')) {
    let body = ''; for await (const chunk of req) body += chunk;
    const request = body ? JSON.parse(body) : {};
    const api = url.pathname.replace('/api/v1', '');
    if (req.method !== 'GET') writes.push({ api, method: req.method, body: request });
    let data = [];
    if (api === '/auth/me') data = session;
    else if (api === '/administration/hospital') data = { hospitalName: 'Synthetic Hospital' };
    else if (api === '/administration/branch-context') data = { organizationAccess: false, branches: [{ branchGuid: 'branch-1', hospitalGuid: 'hospital-1', branchCode: 'MAIN', branchName: 'Main', branchTypeCode: 'HOSPITAL', isDefault: true, isActive: true }] };
    else if (api.includes('/localization/catalog')) data = { version: 1, effectiveCulture: 'en-US', languages: [], resources: {}, seedDataSets: [] };
    else if (api.includes('/localization/version')) data = { version: 1 };
    else if (api === '/notification-inbox/refresh') data = { refreshed: true };
    else if (api === '/notification-inbox/read-all') { notifications.forEach(item => item.readAt = new Date().toISOString()); data = { changed: notifications.length }; }
    else if (api.endsWith('/read') && api.startsWith('/notification-inbox/')) { const item = notifications.find(item => item.id === api.split('/')[2]); if (item) item.readAt = new Date().toISOString(); data = { read: true }; }
    else if (api === '/notification-inbox') data = { items: notifications.slice(0, 30), unreadCount: notifications.filter(item => !item.readAt).length, total: notifications.length, page: 1, pageSize: 30 };
    else if (api === '/ipd/dashboard') data = dashboard(url.searchParams.get('empty') === 'true' || req.headers.cookie?.includes('ipd-empty=true'));
    else if (api === '/laboratory/tests') data = [{ id: 'test-1', name: 'Sample lab panel', code: 'SAMPLE', category: 'General', price: 200, isActive: true }];
    else if (/^\/patients\//.test(api)) data = { allergies: [], knownAllergies: 'Example allergen', bloodGroupName: 'O+', pastMedicalHistory: 'Synthetic history' };
    else if (api.includes('/doctor-rounds')) {
      const id = api.split('/')[3];
      if (req.method === 'POST') { data = { ...request, admissionId: id, roundId: 'round-' + Date.now(), doctorName: 'Dr. Sample', patientConditionName: request.patientCondition, createdAt: now }; rounds.set(id, [data, ...(rounds.get(id) || [])]); }
      else data = rounds.get(id) || [];
    } else if (api.endsWith('/vitals')) {
      const id = api.split('/')[3];
      if (req.method === 'POST') { data = { ...request, admissionId: id, vitalId: 'vital-' + Date.now(), createdAt: now }; vitals.set(id, [data, ...(vitals.get(id) || [])]); }
      else data = vitals.get(id) || [];
    } else if (api.endsWith('/discharge-readiness')) { const id = api.split('/')[3]; const patient = patients.find(patient => patient.admissionId === id); data = { pendingInvestigations: patient?.activeOrders || 0, unbilledCharges: 0, outstanding: patient?.outstanding || 0, draft: drafts.get(id) || '' }; }
    else if (api.endsWith('/discharge-draft')) { drafts.set(api.split('/')[3], request.summary); data = { saved: true }; }
    else if (api.endsWith('/nursing-notes')) data = { id: 'note-1', admissionId: api.split('/')[3], note: request.note, createdAt: now };
    else if (api.endsWith('/status') && api.includes('/beds/')) { const bed = beds.find(bed => bed.bedId === api.split('/')[4]); if (bed) bed.statusCode = request.statusCode; data = bed; }
    else if (api === '/laboratory/orders' && req.method === 'POST') data = { orderNumber: 'SAMPLE-ORDER-001' };
    else if (req.method !== 'GET') { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ success: false, message: 'This mutation is not supported by the preview fixture.', data: null })); }
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ success: true, data, message: '', timestamp: now }));
  }
  let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const ext = path.extname(file);
  res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[ext] || 'application/octet-stream');
  if (ext === '.js') return res.end(fs.readFileSync(file, 'utf8').replaceAll('https://auspira-tech-360-product-api.onrender.com/api/v1', '/api/v1'));
  fs.createReadStream(file).pipe(res);
});
server.listen(4311, '127.0.0.1', () => console.log('Synthetic IPD preview: http://127.0.0.1:4311/fixture'));
