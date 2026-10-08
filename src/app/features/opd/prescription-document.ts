import { OpdDiagnosisForm, OpdPrescriptionItemForm } from './opd-management.models';

export interface PrescriptionPreview {
  hospitalAddress?: string;
  hospitalContact?: string;
  allergySummary?: string;
  qrImage?: string;
  accessUrl?: string;
  accessExpiresAt?: string;
  hospitalName: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  ageGender: string;
  doctorName: string;
  doctorQualification: string;
  doctorRegistrationNo: string;
  departmentName: string;
  branchName: string;
  appointmentId: string;
  appointmentNo: string;
  opdEncounterId: string;
  opdEncounterNo: string;
  clinicalRecordNo: string;
  prescriptionId: string;
  prescriptionNo: string;
  statusLabel: string;
  revisionNo: number;
  generatedAt: string;
  includeVitals: boolean;
  vitals: PrescriptionVital[];
  diagnoses: OpdDiagnosisForm[];
  medicines: OpdPrescriptionItemForm[];
  investigations: string[];
  procedures: string[];
  advice: string[];
  dietAdvice: string[];
  followUp: string[];
  symptomSummary: string;
  diagnosisSummary: string;
  vitalSummary: string;
  followUpSummary: string;
  notes: string;
}

export type PrescriptionPrintFormat = 'A4' | 'A5' | 'THERMAL';

export interface PrescriptionPrintOptions {
  format: PrescriptionPrintFormat;
  includeHospitalHeader: boolean;
  includeDoctorSignature: boolean;
  includeQrCode: boolean;
  includeVitals: boolean;
  includeDiagnosis: boolean;
  includeAdvice: boolean;
  includeFollowUp: boolean;
}

export function defaultPrescriptionPrintOptions(): PrescriptionPrintOptions {
  return {
    format: 'A4',
    includeHospitalHeader: true,
    includeDoctorSignature: true,
    includeQrCode: true,
    includeVitals: true,
    includeDiagnosis: true,
    includeAdvice: true,
    includeFollowUp: true
  };
}

export interface PrescriptionVital {
  label: string;
  value: string;
}

export function openPrescriptionDocument(prescription: PrescriptionPreview, autoPrint: boolean, options: PrescriptionPrintOptions = defaultPrescriptionPrintOptions()): boolean {
  const popup = window.open('', '_blank', 'width=980,height=800');
  if (!popup) {
    return false;
  }

  popup.document.open();
  popup.document.write(printablePrescriptionHtml(prescription, autoPrint, options));
  popup.document.close();
  popup.focus();
  return true;
}

export function printablePrescriptionHtml(prescription: PrescriptionPreview, autoPrint: boolean, options: PrescriptionPrintOptions): string {
  const medicineRows = prescription.medicines.map((item, index) => `
    <tr><td>${index + 1}</td><td><strong>${escapeHtml(formatPrescriptionMedicineName(item))}</strong><small>${escapeHtml(item.dosageForm)}</small></td>
      <td>${escapeHtml(item.dosage)}</td><td>${escapeHtml(item.frequency)}</td><td>${escapeHtml(item.route)}</td><td>${escapeHtml(prescriptionDuration(item.duration))}</td><td>${escapeHtml(item.quantity)}</td></tr>
    ${item.instructions || item.isPrn ? `<tr class="instructions"><td></td><td colspan="6">${escapeHtml([item.instructions, item.isPrn ? 'As needed: ' + (item.prnReason || '') : ''].filter(Boolean).join(' · '))}</td></tr>` : ''}
  `).join('') || '<tr><td colspan="7">No medicines recorded.</td></tr>';
  const investigationRows = prescription.investigations.length ? printableList(prescription.investigations) : '';
  const procedureRows = prescription.procedures.length ? printableList(prescription.procedures) : '';
  const adviceRows = printableList(prescription.advice.length ? prescription.advice : [prescription.notes || 'Follow medical advice and return if symptoms worsen.']);
  const dietAdviceRows = prescription.dietAdvice.length ? printableList(prescription.dietAdvice) : '';
  const followUpRows = prescription.followUp.length ? `<p>${escapeHtml(prescription.followUpSummary)}</p>` : '';
  const formatClass = `format-${options.format.toLowerCase()}`;
  const showHeader = options.includeHospitalHeader;
  const showSignature = options.includeDoctorSignature;
  const showQr = options.includeQrCode && Boolean(prescription.qrImage);
  const showVitals = options.includeVitals && prescription.includeVitals;
  const showDiagnosis = options.includeDiagnosis;
  const showAdvice = options.includeAdvice;
  const showFollowUp = options.includeFollowUp;

  return `<!doctype html>
<html>
<head>
  <title>Prescription - ${escapeHtml(prescription.patientName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; color: #0f172a; font-family: Arial, sans-serif; background: #f8fafc; }
    .paper { max-width: 860px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; background: white; overflow: hidden; }
    .paper.format-a5 { max-width: 620px; font-size: 13px; }
    .paper.format-thermal { max-width: 360px; font-size: 12px; }
    h1, h2, h3, p { margin: 0; }
    .sheet-head { display: grid; grid-template-columns: 74px 1fr auto; gap: 14px; align-items: center; padding: 24px 28px; border-bottom: 1px solid #dbe4f0; text-align: center; }
    .logo { width: 62px; height: 62px; display: grid; place-items: center; border: 1px solid #bfdbfe; border-radius: 16px; background: #eff6ff; color: #2563eb; font-size: 30px; font-weight: 900; }
    .label { color: #64748b; font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .sheet-head h1 { font-size: 27px; }
    .sheet-head span, .sheet-head small, .muted { color: #64748b; font-weight: 700; }
    .sheet-head aside { display: grid; gap: 4px; justify-items: end; text-align: right; }
    .sheet-head aside strong { color: #2563eb; font-size: 14px; }
    .doctor { padding: 18px 28px; border-bottom: 1px solid #dbe4f0; text-align: center; }
    .doctor h2 { font-size: 22px; }
    .doctor p { margin-top: 6px; font-weight: 700; }
    .patient { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 32px; padding: 18px 28px; border-bottom: 1px solid #dbe4f0; }
    .patient div { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 5px; border-bottom: 1px dashed #cbd5e1; }
    .patient small { color: #64748b; font-weight: 800; }
    .patient strong { text-align: right; }
    .patient p { grid-column: 1 / -1; margin-top: 2px; font-weight: 700; line-height: 1.45; }
    .patient p strong { color: #64748b; }
    .rx { min-height: 230px; padding: 22px 28px; border-bottom: 1px solid #dbe4f0; }
    .rx h3 { margin-bottom: 14px; font-family: Georgia, serif; font-size: 34px; font-style: italic; }
    .rx ol { display: grid; gap: 16px; margin: 0; padding-left: 24px; }
    .rx li strong { display: block; font-size: 16px; }
    .rx li span { display: block; margin-top: 4px; color: #64748b; font-weight: 700; }
    .extras { display: grid; grid-template-columns: repeat(2, 1fr); border-bottom: 1px solid #dbe4f0; }
    .extras section { padding: 18px 28px; border-right: 1px solid #dbe4f0; border-bottom: 1px solid #dbe4f0; }
    .extras section:nth-child(even), .extras section:last-child { border-right: 0; }
    .extras .wide { grid-column: 1 / -1; border-right: 0; }
    .extras h3 { margin-bottom: 8px; font-size: 16px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin-bottom: 5px; font-weight: 700; }
    .foot { display: grid; grid-template-columns: auto 1fr minmax(190px, auto); gap: 14px; align-items: end; padding: 18px 28px; border-bottom: 1px solid #dbe4f0; }
    .qr { width: 74px; height: 74px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 6px; border: 1px solid #cbd5e1; }
    .qr span { background: #0f172a; }
    .signature { display: grid; gap: 8px; justify-items: end; text-align: right; }
    .signature::before { content: ''; width: 180px; border-top: 1px solid #475569; }
    .disclaimer { padding: 12px 28px 16px; color: #64748b; font-size: 11.5px; line-height: 1.5; }
    .foot.no-qr { grid-template-columns: 1fr; }
    .foot.no-signature { grid-template-columns: auto 1fr; }
    .paper.format-a5 .sheet-head,
    .paper.format-a5 .doctor,
    .paper.format-a5 .patient,
    .paper.format-a5 .rx,
    .paper.format-a5 .extras section,
    .paper.format-a5 .foot { padding-left: 18px; padding-right: 18px; }
    .paper.format-a5 .sheet-head { grid-template-columns: 58px 1fr; text-align: left; }
    .paper.format-a5 .sheet-head aside { grid-column: 1 / -1; justify-items: start; text-align: left; }
    .paper.format-a5 .logo { width: 52px; height: 52px; font-size: 26px; }
    .paper.format-a5 .sheet-head h1 { font-size: 23px; }
    .paper.format-a5 .patient, .paper.format-a5 .extras, .paper.format-a5 .foot { grid-template-columns: 1fr; }
    .paper.format-a5 .extras section { border-right: 0; }
    .paper.format-thermal .sheet-head,
    .paper.format-thermal .doctor,
    .paper.format-thermal .patient,
    .paper.format-thermal .rx,
    .paper.format-thermal .extras section,
    .paper.format-thermal .foot,
    .paper.format-thermal .disclaimer { padding-left: 14px; padding-right: 14px; }
    .paper.format-thermal .sheet-head { grid-template-columns: 1fr; justify-items: start; text-align: left; }
    .paper.format-thermal .sheet-head aside { justify-items: start; text-align: left; }
    .paper.format-thermal .logo { width: 48px; height: 48px; font-size: 24px; }
    .paper.format-thermal .sheet-head h1 { font-size: 20px; }
    .paper.format-thermal .doctor { text-align: left; }
    .paper.format-thermal .doctor h2 { font-size: 18px; }
    .paper.format-thermal .patient,
    .paper.format-thermal .extras,
    .paper.format-thermal .foot { grid-template-columns: 1fr; }
    .paper.format-thermal .patient div { display: grid; gap: 3px; }
    .paper.format-thermal .patient strong { text-align: left; }
    .paper.format-thermal .rx { min-height: 120px; }
    .paper.format-thermal .rx h3 { font-size: 26px; }
    .paper.format-thermal .extras section { border-right: 0; }
    .paper.format-thermal .signature { justify-items: start; text-align: left; }
    .paper.format-thermal .signature::before { width: 140px; }
    .paper { border-top: 5px solid #6037c9; border-radius: 12px; }
    .sheet-head { grid-template-columns: 62px minmax(0, 1fr) 140px; padding: 22px 26px; }
    .logo { border-color: #ddd5f7; background: #f5f0ff; color: #6135be; }
    .sheet-head h1 { font-size: 26px; color: #233052; }
    .hospital-contact { font-size: 11px; color: #61718a; margin-top: 5px; line-height: 1.5; }
    .doctor { background: #f8f6fc; padding: 14px 26px; }
    .patient { font-size: 13px; padding: 18px 26px; gap: 10px 26px; }
    .patient p { font-weight: 400; font-size: 12px; }
    .rx { min-height: 160px; padding: 18px 26px; }
    .patient .vital-grid { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8f9fc; padding: 14px; border: 0; }
    .patient .vital-grid div { display: grid; gap: 5px; border: 0; }
    .patient .vital-grid strong { text-align: left; font-size: 12px; }
    .rx-caption { font: 600 14px Arial, sans-serif; padding-left: 10px; }
    .medicine-table { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th { background: #f5f2fb; color: #513b79; text-align: left; font-size: 10px; padding: 10px 8px; }
    td { padding: 13px 8px; border-bottom: 1px solid #e6e9f1; vertical-align: top; overflow-wrap: anywhere; }
    td small { display: block; margin-top: 4px; color: #65728a; font-size: 10px; }
    .instructions td { padding-top: 0; color: #5b6980; font-size: 11px; }
    tr { break-inside: avoid; } .extras section, .foot, .doctor { break-inside: avoid; }
    .extras section { padding: 18px 26px; font-size: 12px; } .extras li { font-weight: 400; line-height: 1.6; }
    .extras h3 { color: #4c337d; font-size: 14px; }
    .foot { grid-template-columns: 128px 1fr 170px; padding: 18px 26px; font-size: 12px; }
    .foot small { display: block; font-size: 10px; margin-top: 6px; line-height: 1.5; }
    .qr { display: block; width: 128px; height: 128px; border: 0; padding: 0; background: white; }
    .signature::before { width: 160px; margin-top: 28px; } .signature { font-size: 11px; }
    .paper.format-thermal table { font-size: 9px; } .paper.format-thermal th, .paper.format-thermal td { padding: 7px 3px; }
    @media(max-width:650px) { body { padding: 12px; }.sheet-head { grid-template-columns: 1fr; }.sheet-head aside { justify-items: center; text-align:center; }.logo { display:none; }.patient,.extras,.foot { grid-template-columns:1fr; }.signature { justify-items:start; text-align:left; } }
    @media print { body { padding: 0; background: white; font-size: 12px; }
      .sheet-head { padding: 12px 20px; gap: 10px; } .sheet-head h1 { font-size: 22px; } .hospital-contact { font-size: 10px; }
      .doctor { padding: 10px 20px; } .doctor h2 { font-size: 18px; } .doctor p { font-size: 12px; margin-top: 4px; }
      .patient { padding: 12px 20px; gap: 8px 20px; font-size: 12px; } .patient p { font-size: 11px; }
      .patient .vital-grid { padding: 10px; gap: 8px; }
      .rx { padding: 14px 20px; min-height: 0; } .rx h3 { margin-bottom: 10px; font-size: 28px; }
      th { padding: 8px 6px; } td { padding: 10px 6px; font-size: 11px; }
      .extras section { padding: 12px 20px; font-size: 11px; } .extras h3 { font-size: 12px; margin-bottom: 6px; }
      .foot { padding: 12px 20px; } .disclaimer { padding: 8px 20px; font-size: 9px; }
      .paper { border-radius: 0; border: 0; }.sheet-head { grid-template-columns: 62px minmax(0,1fr) 140px; }.sheet-head aside { justify-items:end; text-align:right; }.logo { display:grid; }.patient,.extras { grid-template-columns:1fr 1fr; }.foot { grid-template-columns:128px 1fr 170px; }.medicine-table { overflow: visible; } @page { size: ${options.format === 'A5' ? 'A5' : options.format === 'THERMAL' ? 'auto' : 'A4'}; margin: 12mm; } }

  </style>
</head>
<body>
  <main class="paper ${formatClass}">
    ${showHeader ? `<header class="sheet-head">
      <div class="logo">+</div>
      <div>
        <p class="label">Outpatient prescription</p>
        <h1>${escapeHtml(prescription.hospitalName)}</h1>
        <span>${escapeHtml(prescription.branchName)}</span><p class="hospital-contact">${escapeHtml(prescription.hospitalAddress || '')}</p><p class="hospital-contact">${escapeHtml(prescription.hospitalContact || '')}</p>
      </div>
      <aside>
        <strong>${escapeHtml(prescription.prescriptionNo)}</strong>
        <small>${escapeHtml(prescription.statusLabel)} · Revision ${prescription.revisionNo}</small>
      </aside>
    </header>` : ''}
    <section class="doctor">
      <h2>${escapeHtml(prescription.doctorName)}</h2>
      <p>${escapeHtml(prescription.doctorQualification)} | Registration No. ${escapeHtml(prescription.doctorRegistrationNo)}</p>
      <span class="muted">${escapeHtml(prescription.departmentName)}</span>
    </section>
    <section class="patient">
      <div><small>Patient</small><strong>${escapeHtml(prescription.patientName)}</strong></div>
      <div><small>Date</small><strong>${escapeHtml(prescription.generatedAt)}</strong></div>
      <div><small>Age / Gender</small><strong>${escapeHtml(prescription.ageGender)}</strong></div>
      <div><small>MRN</small><strong>${escapeHtml(prescription.patientMrn)}</strong></div>
      ${showVitals ? `<div class="vital-grid">${prescription.vitals.map(vital => `<div><small>${escapeHtml(vital.label)}</small><strong>${escapeHtml(vital.value)} <small>${escapeHtml(({ 'Blood Pressure': 'mmHg', 'Pulse Rate': 'bpm', 'Temperature': '°F', 'SpO2': '%', 'Weight': 'kg', 'Height': 'cm' } as Record<string, string>)[vital.label] || '')}</small></strong></div>`).join('')}</div>` : ''}
      <p><strong>Allergies:</strong> ${escapeHtml(prescription.allergySummary || 'Not recorded — verify with patient')}</p><p><strong>Symptoms:</strong> ${escapeHtml(prescription.symptomSummary)}</p>
      ${showDiagnosis ? `<p><strong>Diagnosis:</strong> ${escapeHtml(prescription.diagnosisSummary)}</p>` : ''}
    </section>
    <section class="rx">
      <h3>Rx <span class="rx-caption">Medicines prescribed</span></h3>
      <div class="medicine-table"><table><thead><tr><th>#</th><th>Medicine / Strength</th><th>Dose</th><th>Frequency</th><th>Route</th><th>Duration</th><th>Qty</th></tr></thead><tbody>${medicineRows}</tbody></table></div>
    </section>
    <div class="extras">
      ${investigationRows ? `<section><h3>Investigations</h3><ul>${investigationRows}</ul></section>` : ''}
      ${procedureRows ? `<section><h3>Procedures</h3><ul>${procedureRows}</ul></section>` : ''}
      ${showAdvice && adviceRows ? `<section><h3>Advice</h3><ul>${adviceRows}</ul></section>` : ''}
      ${dietAdviceRows ? `<section><h3>Diet Advice</h3><ul>${dietAdviceRows}</ul></section>` : ''}
      ${showFollowUp && followUpRows ? `<section class="wide"><h3>Follow-up</h3>${followUpRows}</section>` : ''}
    </div>
    ${(showQr || showSignature) ? `<footer class="foot ${!showQr ? 'no-qr' : ''} ${!showSignature ? 'no-signature' : ''}">
      ${showQr ? `<img class="qr" src="${escapeHtml(prescription.qrImage || '')}" alt="Scan to view prescription and visit history" />
      <div>
        <strong>Scan for prescription & visit history</strong>
        <small class="muted">Patient access code or hospital login required.</small><small class="muted">Link expires ${escapeHtml(prescription.accessExpiresAt ? new Date(prescription.accessExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')}</small>
      </div>` : ''}
      ${showSignature ? `<div class="signature">
        <strong>Doctor Signature</strong>
        <span class="muted">${escapeHtml(prescription.doctorName)}</span>
      </div>` : ''}
    </footer>` : ''}
    <p class="disclaimer">Disclaimer: This prescription is generated from the Care360 OPD encounter and should be used only under the advice of the issuing doctor.</p>
  </main>
  ${autoPrint ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 150));</script>' : ''}
</body>
</html>`;
}

function formatPrescriptionMedicineName(item: OpdPrescriptionItemForm): string {
  return [item.medicine, item.strength].filter(Boolean).join(' ');
}

function prescriptionDuration(value: string): string {
  return /^\d+(?:\.\d+)?$/.test(value.trim()) ? `${value.trim()} days` : value;
}

function printableList(items: string[]): string {
  return items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}