import { StoreForm, choice, field, reason, select } from './stores.models';

const serviceKinds = ['DAYCARE', 'DIALYSIS', 'PHYSIOTHERAPY'];
const serviceKind = choice('kind', 'Service', serviceKinds);
const episode = select('episodeId', 'Allied care episode', 'episodes');
const session = select('sessionId', 'Session', 'sessions');
const note = field('note', 'Clinical evidence', 'textarea');
const dietOrder = select('orderId', 'Active diet order', 'dietOrders');
const chargeFields = [
  select('sourceId', 'Signed session charge source', 'chargeSources'),
  select('contractId', 'Approved contract or package', 'contracts'),
  select('coverageId', 'Patient coverage', 'coverages', true),
  reason
];

const sessionActions: { action: string; title: string; permission: string; states: string[] }[] = [
  { action: 'READINESS', title: 'Confirm readiness against plan', permission: 'Deliver', states: ['SCHEDULED'] },
  { action: 'START', title: 'Start session', permission: 'Deliver', states: ['READY'] },
  { action: 'OBSERVATION', title: 'Record session observation or therapy progress', permission: 'Deliver', states: ['ACTIVE', 'PAUSED'] },
  { action: 'MEDICATION_RECORD', title: 'Link existing prescription record', permission: 'Deliver', states: ['ACTIVE', 'PAUSED'] },
  { action: 'PAUSE', title: 'Record interruption', permission: 'Deliver', states: ['ACTIVE'] },
  { action: 'RESUME', title: 'Resume session', permission: 'Deliver', states: ['PAUSED'] },
  { action: 'COMPLETE', title: 'Sign outcome and follow-up', permission: 'Sign', states: ['ACTIVE', 'PAUSED'] },
  { action: 'MISS', title: 'Record missed appointment', permission: 'Schedule', states: ['SCHEDULED', 'READY'] },
  { action: 'CANCEL', title: 'Cancel booked session', permission: 'Schedule', states: ['SCHEDULED', 'READY'] }
];

function careForms(tab: string): StoreForm[] {
  const therapy = tab === 'physiotherapy';
  const prefix = therapy ? { kind: 'PHYSIOTHERAPY' } : {};
  return [
    { key: 'referral', tab, title: therapy ? 'Refer for physiotherapy' : 'Open daycare or dialysis episode',
      permission: 'Allied.Refer', path: '/allied/referrals', fixed: prefix,
      fields: [select('patientId', 'Verified patient', 'patients'),
        ...(!therapy ? [choice('kind', 'Service', ['DAYCARE', 'DIALYSIS'])] : []), field('referral', 'Referral and clinical indication', 'textarea')] },
    { key: 'plan', tab, title: 'Sign assessment, care plan, and follow-up', permission: 'Allied.Plan', path: '/allied/plans',
      versionFrom: 'episodes', revisionField: 'episodeId',
      fields: [episode, field('assessment', 'Assessment and goals', 'textarea'), field('instructions', 'Clinician-directed plan', 'textarea'),
        field('followUp', 'Follow-up plan', 'textarea')] },
    { key: 'booking', tab, title: 'Book a resource and named performer', permission: 'Allied.Schedule', path: '/allied/bookings',
      fields: [episode, select('planId', 'Current signed plan', 'plans'), select('resourceId', 'Chair, bay, or therapy space', 'resources'),
        select('performerId', 'Verified performer', 'performers'), field('startsAt', 'Starts (local time)', 'datetime-local'), field('endsAt', 'Ends (local time)', 'datetime-local')] },
    { key: 'reschedule', tab, title: 'Reschedule or replace a missed visit', permission: 'Allied.Schedule',
      path: '/allied/sessions/{sessionId}/reschedule', versionFrom: 'sessions', states: ['SCHEDULED','READY','MISSED'],
      fields: [session, episode, select('planId','Current signed plan','plans'), select('resourceId','Resource','resources'),
        select('performerId','Named performer','performers'),field('startsAt','New start','datetime-local'),field('endsAt','New end','datetime-local'),reason] },
    { key: 'supplyReturn', tab, title: 'Return verified unused session supply', permission: 'Allied.Deliver', path: '/allied/supply-returns',
      fields: [select('supplyId','Original supply issue','sessionSupplies'),field('quantity','Unused quantity','number'),reason] },
    { key: 'followup', tab, title: 'Assign follow-up or pending care', permission: 'Allied.Plan', path: '/allied/followups',
      fields: [episode,select('ownerId','Named owner','followupOwners'),field('dueAt','Review due','datetime-local'),
        choice('kind','Follow-up type',['RESULT_REVIEW','FOLLOW_UP','PENDING_CARE']),field('instructions','Care and review instructions','textarea')] },
    { key: 'resolveFollowup', tab, title: 'Record assigned follow-up outcome', permission: 'Allied.View', path: '/allied/followup-reviews',
      fields: [select('followupId','Assigned follow-up','followups'),field('outcome','Reviewed outcome','textarea')] },
    ...(!therapy ? [{ key:'surgicalLink',tab,title:'Link prior surgery for follow-up',permission:'Allied.Plan',path:'/allied/surgical-links',
      fields:[episode,select('caseId','Matching postoperative case','surgicalCases'),reason] }] : [
      {key:'measure',tab,title:'Register reviewed outcome measure',permission:'Allied.Plan',path:'/allied/outcome-measures',
        fields:[field('code','Measure code'),field('name','Measure name'),field('unit','Score unit'),field('minimum','Minimum score','number'),
          field('maximum','Maximum score','number'),field('reference','Approved instrument reference')]},
      {key:'score',tab,title:'Record therapy outcome measure',permission:'Allied.Deliver',path:'/allied/outcome-scores',
        fields:[session,select('definitionId','Reviewed instrument','therapyMeasures'),choice('stage','Assessment stage',['BASELINE','PROGRESS','DISCHARGE']),
          field('value','Measured score','number'),note]}
    ]),
    ...sessionActions.filter(row => !therapy || row.action !== 'MEDICATION_RECORD').map(row => ({
      key: row.action.toLowerCase(), tab, title: row.title, permission: 'Allied.' + row.permission,
      path: '/allied/sessions/{sessionId}/actions', versionFrom: 'sessions', fixed: { action: row.action }, states: row.states,
      fields: [session, note, ...(row.action === 'MEDICATION_RECORD' ? [field('reference', 'Existing prescription record ID')] : []),
        ...(row.action === 'COMPLETE' ? [field('followUp', 'Signed follow-up', 'textarea')] : [])]
    })),
    { key: 'supply', tab, title: 'Record traceable general-stock consumption', permission: 'Allied.Deliver',
      path: '/allied/sessions/{sessionId}/supplies', versionFrom: 'sessions', states: ['ACTIVE'],
      fields: [session, select('lotId', 'Stock lot', 'lots'), select('locationId', 'Store location', 'locations'), field('quantity', 'Quantity', 'number'), reason] },
    { key: 'closeEpisode', tab, title: 'Close allied care episode', permission: 'Allied.Sign',
      path: '/allied/episodes/{episodeId}/close', fields: [episode, reason] }
  ];
}

const medicationForms: StoreForm[] = [
  {key:'homeMedicine',tab:'medications',title:'Review a home medication',permission:'Allied.Plan',path:'/allied/home-medications',
    fields:[episode,select('medicineId','Mapped medicine','medicines',true),select('previousId','Entry being reassessed','homeMedications',true),
      field('name','Medicine or explicit none'),field('dose','Reported dose'),field('route','Reported route'),field('frequency','Reported frequency'),
      choice('decision','Reconciliation decision',['CONTINUE','HOLD','STOP','UNKNOWN','NONE']),field('source','History source'),reason]},
  {key:'medicationReview',tab:'medications',title:'Sign medication reconciliation',permission:'Allied.Plan',path:'/allied/medication-reviews',
    fields:[episode,choice('kind','Review stage',['INTAKE','DISCHARGE']),field('revision','Current review revision','number'),
      field('allergiesReviewed','Current allergies reviewed','checkbox'),field('summary','Signed reconciliation summary','textarea')]},
  {key:'prescribe',tab:'medications',title:'Sign explicit session dose',permission:'Allied.Plan',path:'/allied/sessions/{sessionId}/medications',
    versionFrom:'sessions',states:['SCHEDULED','READY','ACTIVE','PAUSED'],
    fields:[session,select('medicineId','Medicine','medicines'),field('doseText','Prescribed dose'),field('route','Prescribed route'),
      field('units','Units to supply for this dose','number'),field('dueAt','Dose due','datetime-local'),field('endsAt','Dose window ends','datetime-local'),
      field('instructions','Prescriber instructions','textarea'),field('duplicateReason','Duplicate therapy review','textarea',true)]},
  {key:'medicationState',tab:'medications',title:'Review or stop a session dose',permission:'Allied.Plan',
    path:'/allied/sessions/{sessionId}/medications/{medicationId}/state',versionFrom:'medications',versionKey:'medicationId',
    fields:[session,select('medicationId','Session medication','medications'),choice('status','Clinical decision',['ACTIVE','ON_HOLD','STOPPED']),reason]},
  {key:'medicationWitness',tab:'medications',title:'Independently verify patient and medication',permission:'Allied.Deliver',
    path:'/allied/sessions/{sessionId}/medications/{medicationId}/witness',versionFrom:'medications',versionKey:'medicationId',
    fields:[session,select('medicationId','Session medication','medications'),field('patientMrn','Verified MRN'),field('patientName','Verified patient name'),reason]},
  {key:'administer',tab:'medications',title:'Record session medication administration',permission:'Allied.Deliver',
    path:'/allied/sessions/{sessionId}/medications/{medicationId}/administrations',versionFrom:'medications',versionKey:'medicationId',
    fields:[session,select('medicationId','Session medication','medications'),choice('outcome','Outcome',['GIVEN','HELD','OMITTED','REFUSED']),
      select('dispensingItemId','Dispensed supply','dispensedSupplies',true),field('units','Actual units','number'),field('doseText','Verified dose'),field('route','Verified route'),
      field('actualAt','Actual time','datetime-local'),choice('verificationMode','Patient verification',['SCANNED','MANUAL_DOWNTIME']),
      field('patientBarcode','Patient scan',undefined,true),field('medicineBarcode','Medicine batch scan',undefined,true),
      select('witnessId','Independent current witness','medicationWitnesses',true),reason]}
];

export const alliedForms: StoreForm[] = [
  ...medicationForms,
  {key:'dietAssessment',tab:'diet',title:'Sign diet referral and assessment',permission:'Allied.Diet',path:'/allied/diet-assessments',
    fields:[select('admissionId','Active admission','admissions'),field('referral','Referral and indication','textarea'),field('assessment','Dietician assessment','textarea'),
      field('nutritionPlan','Clinician-directed nutrition plan','textarea'),field('allergiesReviewed','Current allergy information reviewed','checkbox')]},
  {key:'chargeReversal',tab:'billing',title:'Reverse source-owned session charge',permission:'Allied.Bill',path:'/allied/charge-reversals',
    fields:[select('chargeId','Current session charge','alliedCharges'),select('adjustmentId','Approved invoice credit','creditAdjustments',true),reason]},
  {key:'mealReplacement',tab:'diet',title:'Replace a missed, rejected, or cancelled meal',permission:'Allied.WardMeal',path:'/allied/meal-replacements',
    fields:[select('originalId','Original meal ticket','meals'),dietOrder,reason]},
  {key:'dietMove',tab:'diet',title:'Verify receiving ward after patient move',permission:'Allied.WardMeal',path:'/allied/diet-destinations',
    fields:[dietOrder,field('destination','Verified ward and bed'),reason]},
  ...careForms('shortStay'),
  ...careForms('physiotherapy'),
  { key: 'resource', tab: 'resources', title: 'Register a care resource', permission: 'Allied.Configure', path: '/allied/resources',
    fields: [field('code', 'Resource code'), field('name', 'Resource name'), serviceKind, select('assetId', 'Linked equipment asset', 'assets', true)] },
  { key: 'charge', tab: 'billing', title: 'Create charge source from signed session', permission: 'Allied.Bill', path: '/allied/charge-sources', states: ['COMPLETED'],
    fields: [session, select('serviceCode', 'Approved service code', 'rates'), reason] },
  { key: 'price', tab: 'billing', title: 'Post approved session charge', permission: 'Allied.Bill', path: '/allied/pricing/post', fields: chargeFields },
  { key: 'dietOrder', tab: 'diet', title: 'Sign or replace a diet order', permission: 'Allied.Diet', path: '/allied/diet-orders',
    fields: [select('admissionId', 'Active admission', 'admissions'),select('assessmentId','Signed current assessment','dietAssessments'), select('replacesId', 'Active order to replace', 'dietOrders', true),
      field('diet', 'Diet instructions', 'textarea'), field('restrictions', 'Reviewed allergies and restrictions', 'textarea'), field('destination', 'Ward and bed destination'), reason] },
  { key: 'cancelDiet', tab: 'diet', title: 'Cancel diet order and pending meals', permission: 'Allied.Diet', path: '/allied/diet-orders/{orderId}/cancel',
    fields: [dietOrder, reason] },
  { key: 'mealRequest', tab: 'diet', title: 'Request meal from active order', permission: 'Allied.WardMeal', path: '/allied/meals',
    fields: [dietOrder, field('serviceDate', 'Service date', 'date'), choice('slot', 'Meal', ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']), reason] },
  ...([
    { action: 'PREPARE', tab: 'kitchen', title: 'Confirm prepared meal', states: ['REQUESTED'], permission: 'Kitchen' },
    { action: 'DISPATCH', tab: 'kitchen', title: 'Dispatch prepared meal', states: ['PREPARED'], permission: 'Kitchen' },
    { action: 'ACKNOWLEDGE', tab: 'diet', title: 'Confirm ward receipt', states: ['DISPATCHED'], permission: 'WardMeal' },
    { action: 'MISS', tab: 'diet', title: 'Record missed meal', states: ['REQUESTED','PREPARED','DISPATCHED'], permission: 'WardMeal' },
    { action: 'REJECT', tab: 'diet', title: 'Reject received meal', states: ['DISPATCHED'], permission: 'WardMeal' },
    { action: 'CANCEL', tab: 'diet', title: 'Cancel meal ticket', states: ['REQUESTED', 'PREPARED', 'DISPATCHED'], permission: 'WardMeal' }
  ]).map(row => ({
    key: 'meal' + row.action, tab: row.tab, title: row.title, permission: 'Allied.' + row.permission, states: row.states,
    path: '/allied/meals/{mealId}/actions', versionFrom: 'meals', fixed: { action: row.action },
    fields: [select('mealId', 'Meal ticket', 'meals'), reason]
  }))
];

