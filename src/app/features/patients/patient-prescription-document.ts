import { OpdClinicalForm } from '../opd/opd-management.models';
import { PrescriptionHospitalHeader } from '../opd/prescription-access.service';
import { PrescriptionPreview } from '../opd/prescription-document';
import { PatientProfile } from './patient-management.models';

export interface SavedPatientPrescription {
  id:string; consultationId:string; clinicalData:string; instructions:string; status:string; createdAt:string;
  doctorName:string|null; qualification:string|null; specialization:string|null;
  registrationNo:string|null; department:string|null; branchName:string|null; investigations:string[];
}
interface LegacyPrescription {
  prescriptionNo:string;
  details:{context:{label:string;value:string}[];vitals:{label:string;value:string}[];
    medicines:{name:string;dosage:string;quantity:string;frequency:string;route:string;duration:string;instruction:string}[];
    investigations:string[];procedures:string[];advice:string[];dietAdvice:string[];followUp:{label:string;value:string}[]};
}
export function savedPatientPrescriptionPreview(patient:PatientProfile,saved:SavedPatientPrescription,header:PrescriptionHospitalHeader|null,hospitalName:string,legacy:LegacyPrescription):PrescriptionPreview {
  let form:Partial<OpdClinicalForm>={};
  try{form=JSON.parse(saved.clinicalData||'{}');}catch{ /* Older records use their stored instruction sections. */ }
  if(form.prescriptionId && form.prescriptionId!==saved.id)form={};
  const context=(key:string)=>legacy.details.context.find(x=>x.label.toLowerCase()===key.toLowerCase())?.value||'';
  const follow=form.followUp;
  const followUp=follow && (follow.followUpRequired||follow.followUpDate||follow.followUpAfterDays) ? [follow.followUpAfterDays?`Follow-up after ${follow.followUpAfterDays} days`:'',
    follow.followUpDate?`Next visit date: ${new Date(follow.followUpDate+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`:'',
    follow.reason?`Reason: ${follow.reason}`:'',follow.notes?`Notes: ${follow.notes}`:''].filter(Boolean) : legacy.details.followUp.map(x=>`${x.label}: ${x.value}`);
  const diagnoses=form.diagnoses||[];
  const vitals=form.vitals;
  const includeVitals=form.includeVitalsInPrescription??Boolean(legacy.details.vitals.length);
  const height=Number(vitals?.height),weight=Number(vitals?.weight);
  const values=vitals ? [
    {label:'Blood Pressure',value:vitals.bloodPressure||'-'},{label:'Pulse Rate',value:vitals.pulseRate||'-'},
    {label:'Temperature',value:vitals.temperature||'-'},{label:'SpO2',value:vitals.spo2||'-'},
    {label:'Weight',value:vitals.weight||'-'},{label:'Height',value:vitals.height||'-'},
    {label:'BMI',value:height>0&&weight>0?(weight/((height/100)**2)).toFixed(1):'-'}] : legacy.details.vitals.map(x=>({label:x.label,value:x.value}));
  const address=header?.address;
  return {
    hospitalName:header?.hospitalName||hospitalName||context('Hospital')||'Auspira Care360',
    hospitalAddress:address?[address.addressLine1,address.addressLine2,address.cityName,address.stateName,address.postalCode].filter(Boolean).join(', '):'',
    hospitalContact:header?.contact?[header.contact.primaryPhone,header.contact.email].filter(Boolean).join(' · '):'',
    patientId:patient.patientGuid,patientName:patient.fullName,patientMrn:patient.medicalRecordNo,
    ageGender:[patient.age!==null?`${patient.age} yrs`:'',patient.genderName].filter(Boolean).join(' / '),
    doctorName:saved.doctorName||context('Doctor')||'Doctor not available',
    doctorQualification:[saved.qualification,saved.specialization].filter(Boolean).join(', ')||'-',
    doctorRegistrationNo:saved.registrationNo||'-',departmentName:saved.department||'-',branchName:saved.branchName||'',
    appointmentId:'',appointmentNo:context('Appointment'),opdEncounterId:saved.consultationId,
    opdEncounterNo:context('OPD Encounter'),clinicalRecordNo:context('OPD Encounter'),prescriptionId:saved.id,
    prescriptionNo:form.prescriptionNo||context('Prescription No')||legacy.prescriptionNo,
    statusLabel:context('Status')||saved.status,revisionNo:Number(context('Revision'))||1,
    generatedAt:context('Generated At')||new Date(saved.createdAt).toLocaleString('en-IN'),
    includeVitals,vitals:includeVitals?values:[],diagnoses,
    medicines:form.prescriptions||legacy.details.medicines.map(m=>({medicine:m.name,strength:'',dosageForm:'',dosage:m.dosage,quantity:m.quantity,frequency:m.frequency,route:m.route,duration:m.duration,instructions:m.instruction})),
    investigations:form.includeInvestigationsInPrescription===false?[]:legacy.details.investigations.length?legacy.details.investigations:[...new Set([...(form.prescriptionInvestigations||[]),...(saved.investigations||[])])],
    procedures:legacy.details.procedures.length?legacy.details.procedures:form.procedures?.map(p=>[p.procedure,p.charge?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(p.charge)):'',p.notes].filter(Boolean).join(' | '))||[],
    advice:form.adviceList||legacy.details.advice,dietAdvice:form.dietAdviceList||legacy.details.dietAdvice,followUp,
    symptomSummary:form.complaints?.map(c=>c.complaint).filter(Boolean).join(', ')||'-',
    diagnosisSummary:diagnoses.map(d=>d.diagnosisName).filter(Boolean).join(', ')||'-',
    vitalSummary:'',followUpSummary:followUp.join(' | ')||'No follow-up recorded',
    notes:form.clinicalNotes||follow?.notes||'',allergySummary:patient.knownAllergies||'Not recorded — verify with patient'
  };
}


