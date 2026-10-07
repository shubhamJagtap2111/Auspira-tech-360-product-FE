// Production-bundle smoke test with synthetic patient data; no live hospital is modified.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve('dist/auspira-care360-web/browser');
const artifacts = path.resolve('artifacts/responsive/opd', process.env.OPD_PHARMACY_INTEGRATION === 'off' ? 'independent' : 'integrated');
const permissions = [...fs.readFileSync('src/app/app.routes.ts', 'utf8').matchAll(/permission: '([^']+)'/g)].map(m => m[1]);
const session = { userId: 'opd-fixture', email: 'doctor@example.test', fullName: 'Dr. Test', accessToken: 'fixture', refreshToken: 'fixture', accessTokenExpiresAt: '2099-01-01T00:00:00Z', permissions, roleCodes: ['HOSPITAL_ADMIN'], menuItems: [], hospitalName: 'OPD Test Hospital', tenantCode: 'test' };
const now = new Date().toISOString();
const pharmacyEnabled = process.env.OPD_PHARMACY_INTEGRATION !== 'off';
session.permissions.push('Administration.SystemConfiguration.Edit');
const ids = { patient: '10000000-0000-0000-0000-000000000001', doctor: '20000000-0000-0000-0000-000000000001', appointment: '30000000-0000-0000-0000-000000000001', consultation: '40000000-0000-0000-0000-000000000001' };
const patient = { patientGuid: ids.patient, medicalRecordNo: 'TEST-001', fullName: 'Synthetic Patient', firstName: 'Synthetic', lastName: 'Patient', age: 35, genderName: 'Female', genderCode: 'FEMALE', mobileNo: '0000000000', knownConditions: 'Not recorded', allergies: [], prescriptions: [], documents: [], labOrders: [], visits: [], appointments: [], timeline: [], overview: {}, contacts: [], insurance: [], billingSummary: {} };
const doctor = { doctorGuid: ids.doctor, fullName: 'Dr. Test', email: session.email, departmentName: 'General Medicine', branchName: 'Main Branch', primarySpecialization: 'General Medicine', consultationFee: 0, statusCode: 'ACTIVE' };
const appointment = { id: ids.appointment, appointmentNo: 'APT-001', patientId: ids.patient, doctorId: ids.doctor, startsAt: now, appointmentType: 'NEW_CONSULTATION', branchName: 'Main Branch', departmentName: 'General Medicine', statusCode: 'CHECKED_IN', createdAt: now };
const queue = { id: '50000000-0000-0000-0000-000000000001', appointmentId: ids.appointment, queueNo: 1, tokenNumber: 'T001', arrivedAt: now, priorityCode: 'NORMAL', statusCode: 'WAITING', createdAt: now };
const previousVisits = [
  { id: 'prior-1', patientId: ids.patient, doctorId: ids.doctor, statusCode: 'COMPLETED', createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), notes: '## Vitals\n- Blood Pressure: 120/80\n- Pulse Rate: 72\n- SpO2: 99\n- Height: 157\n- Weight: 65\n- BMI: 26.4\n\n## Chief Complaints\n- Review of prior symptoms | 2 days | Moderate\n\n## Clinical History\n- Present Illness: Recorded narrative,\ncontinued on the next line.\n- Family History: -\n\n## Examination\n- General Examination: Previous examination documented\n\n## Diagnosis\n- PRIMARY | R69 | Prior diagnostic review\n\n## Prescription\n- Example medicine | 500 mg | Tablet | 1 tablet | Qty: 6 | Twice Daily | Oral | 3 days | After food\n\n## Advice\n- Advice recorded for the patient\n\n## Follow-up\n- Required: Yes\n- After: 7 days' },
  { id: 'prior-2', patientId: ids.patient, doctorId: ids.doctor, statusCode: 'DRAFT', createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), notes: 'Older free-form clinical note.\nFurther narrative is preserved.' }
];
const labResult = { id: 'result-1', testName: 'Example panel', parameterName: 'Example parameter', value: '12.5', unit: 'g/dL', referenceRange: '12–15', flagCode: 'NORMAL', isCritical: false, verifiedAt: now };
const labReport = { id: 'report-1', reportNumber: 'LAB-TEST-001', orderNumber: 'LO-001', patientId: ids.patient, currentVersion: 2, statusCode: 'REPORT_RELEASED', releasedAt: now };
patient.documents = [{ documentGuid: 'document-1', documentName: 'Example imaging report', documentType: 'Radiology', uploadedDate: now }];
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const ext = path.extname(file);
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[ext] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  try {
    fs.mkdirSync(artifacts, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
    const errors = [], writes = [], pharmacyRequests = [];
    let consultation = null, conflictNextSave = false, failReportDownload = true, configuredIntegration = !pharmacyEnabled;
    const integrationSetting = () => ({ settingKey: 'OPD.PharmacyIntegration.Enabled', settingCategoryCode: 'APPLICATION', settingValue: String(configuredIntegration), dataType: 'Boolean', displayNameKey: 'Integrate OPD with Pharmacy', descriptionKey: 'Select hospital catalogue medicines when enabled. Enter medicine names independently when disabled.', isEncrypted: false, sortOrder: 10, isActive: true, rowVersion: '' });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(session => localStorage.setItem('care360.auth.session', JSON.stringify(session)), session);
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!url.pathname.includes('/api/')) {
        if (url.origin !== base) return route.abort();
        return route.continue();
      }
      const p = url.pathname.replace(/^.*\/api\/v1/, ''), method = request.method();
      if (p.startsWith('/pharmacy/') || p.endsWith('/send-to-pharmacy')) pharmacyRequests.push(p);
      if (p === '/laboratory/reports/report-1/pdf') {
        assert.equal(url.searchParams.get('version'), '2');
        if (failReportDownload) { failReportDownload = false; return route.fulfill({ status: 503, json: { message: 'Unavailable' } }); }
        return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\nSynthetic test report\n%%EOF' });
      }
      let data = [];
      if (method !== 'GET') writes.push({ path: p, body: request.postDataJSON() });
      if (p === '/auth/me') data = session;
      else if (p === '/opd/configuration') data = { pharmacyIntegrationEnabled: configuredIntegration };
      else if (p === '/administration/system-configuration') data = { settings: [integrationSetting()], numberSeries: [], fiscalYears: [], notificationTemplates: [] };
      else if (p === '/administration/system-configuration/settings' && method === 'PUT') {
        configuredIntegration = request.postDataJSON().settings.find(setting => setting.settingKey === 'OPD.PharmacyIntegration.Enabled').settingValue === 'true';
        data = [integrationSetting()];
      }
      else if (p === '/opd/medicine-catalog') data = [
        { id: '60000000-0000-0000-0000-000000000001', name: 'Synthetic medicine', strength: '500 mg', dosageForm: 'Tablet', unit: 'Strip', genericName: 'Synthetic medicine' },
        { id: '60000000-0000-0000-0000-000000000002', name: 'Paracetamol', strength: '500 mg', dosageForm: 'Tablet', unit: 'Strip', genericName: 'Paracetamol' },
        { id: '60000000-0000-0000-0000-000000000003', name: 'ORH', strength: '567', dosageForm: 'Tablet', unit: 'Strip', genericName: 'PARACITAMOAL' }
      ];
      else if (p === '/pharmacy/allergies/check' || p === '/pharmacy/interactions/check') data = [];
      else if (p === '/administration/hospital') data = { hospitalName: 'OPD Test Hospital' };
      else if (p === '/patients') data = { patients: [patient], totalCount: 1, pageNumber: 1, pageSize: 100, stats: {} };
      else if (p === `/patients/${ids.patient}`) data = patient;
      else if (p === '/doctors') data = { doctors: [doctor], totalCount: 1, pageNumber: 1, pageSize: 100, stats: {} };
      else if (p === '/appointments') data = [appointment];
      else if (p === '/appointments/queue' || p === '/queue' || p === '/queues') data = [queue];
      else if (p === '/opd/consultations' && method === 'GET') data = consultation ? [consultation] : [];
      else if (p === '/opd/consultations' && method === 'POST') {
        consultation = { ...request.postDataJSON(), id: ids.consultation, createdAt: now, startedAt: now, updatedAt: now };
        data = consultation;
      } else if (p === `/opd/consultations/${ids.consultation}/draft`) {
        if (conflictNextSave) {
          conflictNextSave = false;
          return route.fulfill({ status: 409, json: { success: false, statusCode: 409, message: 'This consultation changed in another session.', errors: [], data: null } });
        }
        const body = request.postDataJSON();
        assert.equal(body.expectedUpdatedAt, consultation.updatedAt);
        consultation = { ...consultation, clinicalData: body.clinicalData, notes: body.notes, updatedAt: new Date().toISOString() };
        data = consultation;
      } else if (p === `/opd/consultations/${ids.consultation}`) data = consultation;
      else if (p.endsWith('/workflow')) {
        const body = request.postDataJSON();
        assert.equal(body.expectedUpdatedAt, consultation.updatedAt);
        consultation = { ...consultation, ...body.consultation, updatedAt: new Date().toISOString() };
        data = consultation;
      } else if (p.endsWith('/history')) data = [...(consultation ? [consultation] : []), ...previousVisits];
      else if (p.endsWith('/lab-results')) data = [labResult];
      else if (p === '/laboratory/reports') {
        assert.equal(url.searchParams.get('patientId'), ids.patient);
        data = [labReport, { ...labReport, id: 'other-patient', patientId: 'other-patient' }, { ...labReport, id: 'unreleased', statusCode: 'DRAFT' }];
      }
      else if (method !== 'GET') data = { ...request.postDataJSON(), id: crypto.randomUUID() };
      return route.fulfill({ json: { success: true, statusCode: 200, data, message: '', errors: [] } });
    });
    await page.goto(base + '/administration/system-configuration');
    const integrationCheckbox = page.getByRole('checkbox', { name: /Integrate OPD with Pharmacy/ });
    await integrationCheckbox.waitFor().catch(async error => {
      console.error({ url: page.url(), errors, settingsPage: await page.locator('body').innerText() });
      throw error;
    });
    assert.equal(await integrationCheckbox.isChecked(), !pharmacyEnabled);
    await integrationCheckbox.setChecked(pharmacyEnabled);
    const settingsSave = page.waitForResponse(response => response.url().endsWith('/administration/system-configuration/settings') && response.request().method() === 'PUT');
    await page.locator('.settings-panel .ac-btn-primary').click();
    await settingsSave;
    await page.reload();
    await integrationCheckbox.waitFor();
    assert.equal(await integrationCheckbox.isChecked(), pharmacyEnabled, 'integration checkbox persists after reload');
    assert.equal(await page.locator('.setting-row small').innerText(), integrationSetting().descriptionKey, 'plain-language setting help remains complete');
    for (const width of [360,768,1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await integrationCheckbox.isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `settings overflow at ${width}px`);
      if (width === 360) await page.locator('.settings-panel').screenshot({ path: path.join(artifacts, 'integration-settings-mobile.png') });
    }
    await page.goto(base + '/opd');
    await page.getByRole('button', { name: 'Start Consultation', exact: true }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Start Consultation', exact: true }).click();
    await page.locator('#opd-assessment').waitFor();
    assert.equal(await page.locator('.encounter-workflow-stepper').count(), 0);
    await page.locator('input[name="complaint"]').fill('Review of symptoms');
    await page.locator('textarea[name="generalExamination"]').fill('Clinical examination documented.');
    await page.waitForFunction(() => document.querySelector('.draft-status')?.textContent.includes('Saved to server'), { timeout: 10000 });
    assert.equal(writes.some(write => /prescriptions|symptoms|diagnoses|laboratory\/orders/.test(write.path)), false, 'autosave must not create downstream records');
    await page.getByRole('button', { name: 'History & results', exact: true }).click();
    await page.getByRole('dialog', { name: 'History & results' }).waitFor();
    await page.locator('.history-timeline-item').filter({ hasText: 'Prior diagnostic review' }).click();
    for (const tone of ['success', 'pending', 'active']) assert.equal(await page.locator(`.history-timeline-item[data-status-tone="${tone}"]`).count(), 1);
    const statusColors = await page.locator('.history-timeline-item').evaluateAll(cards => cards.map(card => getComputedStyle(card).backgroundColor));
    assert.equal(new Set(statusColors).size, 3, 'process cards have distinct green, yellow, and orange backgrounds');
    assert.equal(await page.locator('.history-consultation-status').getAttribute('data-status-tone'), 'success');
    assert.equal(await page.locator('.history-vitals').getByText('120/80', { exact: true }).count(), 1);
    assert.equal(await page.locator('.history-medicines').getByText('Example medicine', { exact: true }).count(), 1);
    assert.equal((await page.locator('.history-detail').innerText()).includes('## Vitals'), false);
    await page.getByText('OPD consultation started', { exact: true }).waitFor({ state: 'hidden', timeout: 10000 });
    await page.locator('.history-drawer').screenshot({ path: path.join(artifacts, 'history-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.equal(await page.locator('.history-close').isVisible(), true);
    await page.locator('.history-drawer').screenshot({ path: path.join(artifacts, 'history-mobile.png') });
    await page.getByRole('button', { name: /Lab reports/ }).click();
    await page.getByRole('heading', { name: 'Lab reports', exact: true }).waitFor();
    assert.equal(await page.locator('.history-lab-report').count(), 1, 'only released reports belonging to this patient are shown');
    assert.equal(await page.locator('.history-result-value').count(), 0, 'individual parameter cards are replaced by complete reports');
    const downloadButton = page.getByRole('button', { name: 'Download PDF for report LAB-TEST-001', exact: true });
    await downloadButton.click();
    await page.getByText('Unable to download lab report', { exact: true }).waitFor();
    await downloadButton.waitFor({ state: 'visible' });
    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'LAB-TEST-001-v2.pdf');
    assert.equal(await download.failure(), null);
    await page.getByText('Unable to download lab report', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await page.locator('.history-drawer').screenshot({ path: path.join(artifacts, 'lab-reports-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.history-drawer').screenshot({ path: path.join(artifacts, 'lab-reports-desktop.png') });
    await page.getByRole('button', { name: /Imaging/ }).click();
    await page.getByRole('heading', { name: 'Example imaging report' }).waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.history-close').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Back to OPD', 'keyboard focus stays within the history dialog');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'History & results', 'closing history restores focus to the opener');
    assert.equal(await page.locator('input[name="complaint"]').inputValue(), 'Review of symptoms');
    const medicineInput = page.locator('input[name="medicine"]');
    const outsideHeading = page.getByRole('heading', { name: 'Treatment plan', exact: true });
    // Dialogs and rows can stop bubbling; dismissal must still see the original event.
    await outsideHeading.evaluate(el => {
      el.addEventListener('pointerdown', event => event.stopPropagation());
      el.addEventListener('click', event => event.stopPropagation());
    });
    for (const width of [360,390,768,1024,1366,1920]) {
      await page.setViewportSize({width,height:900});
      await medicineInput.fill('PARACITAMO');
      await page.locator('.medicine-suggestions').waitFor();
      assert.match(await page.locator('.medicine-suggestions').innerText(), /Paracetamol/);
      assert.match(await page.locator('.medicine-suggestions').innerText(), /ORH/);
      assert.match(await page.locator('.medicine-suggestions').innerText(), /PARACITAMOAL/);
      assert.equal(await medicineInput.inputValue(), 'PARACITAMO', 'a close match never automatically changes the prescription');
      await medicineInput.fill('');
      await medicineInput.fill('Synthetic medicine');
      await page.locator('.medicine-suggestions').waitFor();
      if (width <= 1024) await outsideHeading.tap(); else await outsideHeading.click();
      await page.locator('.medicine-suggestions').waitFor({state:'hidden'});
      assert.equal(await medicineInput.inputValue(), 'Synthetic medicine', 'outside dismissal retains typed medicine');
      await medicineInput.click();
      await page.locator('.medicine-suggestions').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('.medicine-suggestions').waitFor({state:'hidden'});
      await medicineInput.click();
      await page.locator('.medicine-suggestions').waitFor();
      await page.locator('input[name="medicineStrength"]').focus();
      await page.locator('.medicine-suggestions').waitFor({state:'hidden'});
      await medicineInput.click();
      await page.locator('.medicine-suggestions button').click();
      await page.locator('.medicine-suggestions').waitFor({state:'hidden'});
      assert.equal(await page.locator('#opd-medicine-catalog-help').innerText(), 'Hospital catalog medicine selected.');
      assert.equal(await page.locator('input[name="medicineStrength"]').inputValue(), '500 mg');
      assert.equal(await page.locator('input[name="dosageForm"]').inputValue(), 'Tablet');
    }
    await page.setViewportSize({width:1440,height:1000});
    // Fully filled text still needs a real catalog selection. Failed Add keeps the editor.
    await page.locator('input[name="medicine"]').fill('Unknown medicine');
    assert.equal(await page.locator('.medicine-suggestions').count(), 0);
    await page.locator('input[name="dosage"]').fill('1 tablet');
    await page.locator('ac-dropdown[name="frequencyPreset"] .ac-dropdown-trigger').click();
    await page.getByRole('button', { name: 'BD - Twice Daily', exact: true }).click();
    await page.locator('input[name="duration"]').fill('5 Days');
    await page.locator('input[name="quantity"]').fill('10');
    if (pharmacyEnabled) {
      await page.getByRole('button', { name: 'Add Medicine', exact: true }).click();
      await page.getByText('Unknown medicine: Catalog medicine selection.', { exact: true }).waitFor();
    } else {
      assert.match(await page.locator('#opd-medicine-catalog-help').innerText(), /suggestion or enter your own medicine name/);
    }
    assert.equal(await page.locator('.medicine-table-row').count(), 0);
    assert.equal(await page.locator('input[name="medicine"]').inputValue(), 'Unknown medicine');
    await page.locator('input[name="medicine"]').fill('Synthetic medicine');
    if (pharmacyEnabled) await page.locator('.medicine-suggestions button').click();
    await page.locator('input[name="quantity"]').fill('');
    await page.getByRole('button', { name: 'Add Medicine', exact: true }).click();
    await page.getByText(/Quantity \(greater than zero\)\.$/).waitFor();
    assert.equal(await page.locator('.medicine-table-row').count(), 0);
    await page.locator('input[name="quantity"]').fill('10');
    await page.locator('ac-dropdown[name="frequencyPreset"] .ac-dropdown-trigger').click();
    await page.getByRole('button', { name: 'SOS - As Needed', exact: true }).click();
    await page.locator('input[name="prnReason"]').waitFor();
    await page.getByRole('button', { name: 'Add Medicine', exact: true }).click();
    await page.getByText(/As-needed indication\.$/).waitFor();
    assert.equal(await page.locator('.medicine-table-row').count(), 0);
    await page.locator('input[name="prnReason"]').fill('Synthetic recorded indication');
    await page.getByRole('button', { name: 'Add Medicine', exact: true }).click();
    assert.equal(await page.locator('.medicine-table-row').count(), 1);
    assert.equal(await page.locator('.medicine-table-row .medicine-validation-error').count(), 0);
    await page.locator('.medicine-composer').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'medicine-validation-desktop.png') });
    await page.getByRole('button', { name: 'Review & Complete', exact: true }).click();
    await page.getByRole('dialog', { name: 'Review consultation' }).waitFor();
    assert.equal(await page.getByRole('dialog').getByText('Review of symptoms', { exact: false }).count() > 0, true);
    await page.screenshot({ path: path.join(artifacts, 'review-desktop.png') });
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    // A conflicting save must preserve the editor and prevent finishing.
    conflictNextSave = true;
    await page.locator('textarea[name="generalExamination"]').fill('Local edit retained after conflict.');
    await page.waitForFunction(() => document.querySelector('.draft-conflict') !== null, { timeout: 10000 });
    assert.equal(await page.getByRole('button', { name: 'Review & Complete', exact: true }).isDisabled(), true);
    assert.equal(await page.locator('textarea[name="generalExamination"]').inputValue(), 'Local edit retained after conflict.');
    await page.getByRole('button', { name: 'Load latest saved version', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.draft-conflict') === null);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#opd-assessment').scrollIntoViewIfNeeded();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
      assert.equal(overflow, false, `page overflow at ${width}px`);
      await page.screenshot({ path: path.join(artifacts, `consultation-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Review & Complete', exact: true }).click();
    await page.getByRole('button', { name: 'Complete Consultation', exact: true }).click();
    await page.locator('.completion-banner').waitFor({ timeout: 15000 });
    assert.equal(consultation.statusCode, 'COMPLETED');
    assert.equal(JSON.parse(consultation.clinicalData).prescriptions[0].medicineId, pharmacyEnabled ? '60000000-0000-0000-0000-000000000001' : null);
    if (!pharmacyEnabled) {
      assert.deepEqual(pharmacyRequests, [], 'independent OPD must never call Pharmacy');
      const savedItem = writes.find(write => write.path === '/opd/prescription-items');
      assert.equal(savedItem.body.medicineId, null);
      assert.equal(savedItem.body.medicineName, 'Synthetic medicine');
    }
    assert.equal(JSON.parse(consultation.clinicalData).prescriptions[0].isPrn, true);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, pharmacyIntegrationEnabled: pharmacyEnabled, checks: ['settings checkbox persistence and three responsive widths', 'start', 'draft-only autosave', 'formatted history and visit selection', 'history results and imaging', 'history keyboard focus', 'history preserves input', ...(pharmacyEnabled ? ['medicine suggestion dismissal at six widths', 'catalog medicine validation and correction'] : ['manual medicine validation and correction', 'null catalogue ID saved with zero Pharmacy requests']), 'review', 'conflict recovery', 'responsive widths', 'completion'], screenshots: artifacts }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
