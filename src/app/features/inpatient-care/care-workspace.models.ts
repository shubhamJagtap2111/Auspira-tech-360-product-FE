export interface CareRow { id: string; status?: string; version?: number; [key: string]: unknown; }
export interface CareAdmission { id: string; patientId: string; patient: string; mrn: string; status: string; enabled: boolean; version: number; wardId?: string; }
export interface CareDetails { admission: CareAdmission; patientBarcode: string; [key: string]: unknown; }
export interface CareField { key: string; label: string; type?: 'text'|'number'|'datetime-local'|'textarea'|'dropdown'|'tests'; source?: string; optional?: boolean; }
export interface CareForm { key: string; title: string; tab: string; permission: string; path: string; fields: CareField[]; }
export interface CareColumn { key: string; label: string; }
export interface CareTable { key: string; title: string; tab: string; columns: CareColumn[]; }

export const nursingForms: CareForm[] = [
  {key:'analyzer',title:'Submit analyzer reference message',tab:'analyzer',permission:'Laboratory',path:'analyzer',fields:[{key:'deviceId',label:'Registered simulation device',type:'dropdown',source:'analyzerDevices'},{key:'messageId',label:'Message control ID (MSH-10)'},{key:'mappingVersion',label:'Pinned mapping version'},{key:'runKind',label:'Run kind',type:'dropdown',source:'runKinds'},{key:'priorRunId',label:'Prior run (required for rerun/correction)',type:'dropdown',source:'analyzerRuns',optional:true},{key:'dilutionFactor',label:'Reported dilution factor (no automatic multiplication)',type:'number'},{key:'reason',label:'Operator reason'},{key:'payload',label:'HL7 ORU R01 v2.5.1 raw message',type:'textarea'}]},
  { key:'shift', title:'Schedule nurse shift', tab:'nursing', permission:'Manage', path:'shifts', fields:[{key:'wardId',label:'Ward',type:'dropdown',source:'wards'},{key:'nurseId',label:'Nurse',type:'dropdown',source:'nurses'},{key:'startsAt',label:'Shift starts',type:'datetime-local'},{key:'endsAt',label:'Shift ends',type:'datetime-local'}]},
  { key:'assign', title:'Assign nurse to patient', tab:'nursing', permission:'Manage', path:'assignments', fields:[{key:'shiftId',label:'Nurse shift',type:'dropdown',source:'shifts'}]},
  { key:'plan', title:'Create care plan', tab:'nursing', permission:'Nurse', path:'plans', fields:[{key:'problem',label:'Care problem',type:'textarea'},{key:'goal',label:'Care goal',type:'textarea'},{key:'interventions',label:'Planned interventions',type:'textarea'}]},
  { key:'task', title:'Schedule care task', tab:'nursing', permission:'Nurse', path:'tasks', fields:[{key:'planId',label:'Care plan',type:'dropdown',source:'plans',optional:true},{key:'title',label:'Task'},{key:'assignedTo',label:'Assigned nurse',type:'dropdown',source:'assignedNurses'},{key:'dueAt',label:'Due at',type:'datetime-local'},{key:'escalateAfterMinutes',label:'Escalate after overdue minutes',type:'number'}]},
  { key:'fluid', title:'Record intake / output', tab:'nursing', permission:'Nurse', path:'fluids', fields:[{key:'direction',label:'Direction',type:'dropdown',source:'fluidDirections'},{key:'route',label:'Route / output type'},{key:'volumeMl',label:'Measured volume (mL)',type:'number'},{key:'observedAt',label:'Observed at',type:'datetime-local'},{key:'note',label:'Nursing note',type:'textarea',optional:true},{key:'replacesId',label:'Correct previous entry',type:'dropdown',source:'fluids',optional:true},{key:'reason',label:'Correction reason (required when replacing)',optional:true}]},
  { key:'handover', title:'Create shift handover', tab:'nursing', permission:'Nurse', path:'handovers', fields:[{key:'toShiftId',label:'Receiving nurse shift',type:'dropdown',source:'assignedShifts'},{key:'situation',label:'Situation',type:'textarea'},{key:'background',label:'Background',type:'textarea'},{key:'assessment',label:'Nursing assessment',type:'textarea'},{key:'recommendation',label:'Recommended next actions',type:'textarea'}]},
  { key:'panel', title:'Define laboratory panel version', tab:'specimens', permission:'Manage', path:'panels', fields:[{key:'code',label:'Panel code'},{key:'version',label:'Version'},{key:'name',label:'Name'},{key:'tests',label:'One canonical observation code=unit per line',type:'tests'}]},
  { key:'specimen', title:'Register specimen', tab:'specimens', permission:'Nurse', path:'specimens', fields:[{key:'orderId',label:'Admission laboratory order',type:'dropdown',source:'labOrders'},{key:'panelId',label:'Panel version',type:'dropdown',source:'panels'},{key:'specimenCode',label:'Specimen reference (must match order)'},{key:'containerCode',label:'Container code'},{key:'sampleType',label:'Sample type'}]}
];
const column=(key:string,label:string):CareColumn=>({key,label});
export const nursingTables: CareTable[] = [
  {key:'analyzerRuns',title:'Analyzer reference runs',tab:'analyzer',columns:[column('messageId','Message'),column('runKind','Kind'),column('status','Status'),column('errorCode','Quarantine reason'),column('dilutionFactor','Dilution'),column('observations','Observations'),column('reviewReason','Review')]},
  {key:'shifts',title:'Ward shift roster',tab:'nursing',columns:[column('nurse','Nurse'),column('ward','Ward'),column('startsAt','Starts'),column('endsAt','Ends'),column('status','Status')]},
  {key:'assignments',title:'Patient nursing assignments',tab:'nursing',columns:[column('nurse','Nurse'),column('startsAt','Shift starts'),column('endsAt','Shift ends'),column('status','Status')]},
  {key:'plans',title:'Care plans',tab:'nursing',columns:[column('problem','Problem'),column('goal','Goal'),column('interventions','Interventions'),column('status','Status')]},
  {key:'tasks',title:'Care tasks',tab:'nursing',columns:[column('title','Task'),column('assignee','Assigned nurse'),column('dueAt','Due'),column('status','Status'),column('outcome','Outcome')]},
  {key:'fluids',title:'Intake / output entries',tab:'nursing',columns:[column('direction','Direction'),column('route','Route / type'),column('volumeMl','mL'),column('observedAt','Observed'),column('replaced','Superseded')]},
  {key:'handovers',title:'Shift handovers',tab:'nursing',columns:[column('sender','From'),column('situation','Situation'),column('background','Background'),column('assessment','Assessment'),column('recommendation','Next actions'),column('acknowledgedAt','Acknowledged')]},
  {key:'escalations',title:'Overdue task escalations',tab:'nursing',columns:[column('title','Task'),column('createdAt','Escalated'),column('acknowledgedAt','Acknowledged')]},
  {key:'specimens',title:'Specimen tracking',tab:'specimens',columns:[column('code','Reference'),column('container','Container'),column('sampleType','Sample type'),column('panel','Panel'),column('panelVersion','Version'),column('status','Status'),column('barcode','Barcode')]}
];

export function carePayload(form: CareForm, values: Record<string,unknown>): Record<string,unknown> {
  const body:Record<string,unknown>={};
  for(const f of form.fields){const value=values[f.key];if((value==null||value==='')&&!f.optional)throw new Error(`${f.label} is required.`);
    if(value==null||value===''){body[f.key]=f.key.endsWith('Id')?null:'';continue;}
    if(f.type==='number'){const n=Number(value);if(!Number.isFinite(n))throw new Error(`${f.label} must be a number.`);body[f.key]=n;}
    else if(f.type==='datetime-local'){const d=new Date(String(value));if(!Number.isFinite(d.getTime()))throw new Error(`${f.label} is invalid.`);body[f.key]=d.toISOString();}
    else if(f.type==='tests'){body[f.key]=String(value).split(/\r?\n/).filter(v=>v.trim()).map(line=>{const i=line.indexOf('=');if(i<1)throw new Error('Use observation code=unit for each panel entry.');return{code:line.slice(0,i).trim(),unit:line.slice(i+1).trim()};});}
    else body[f.key]=String(value).trim();
  }return body;
}
