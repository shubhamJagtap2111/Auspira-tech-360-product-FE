export interface HelpArticle { id: string; category: string; title: string; summary: string; icon: string; route: string; steps: string[]; }
// Authored product guidance, shipped with the application; no fabricated live data.
export const helpArticles: HelpArticle[] = [
  { id:'access',category:'Getting started',title:'Access, roles and branch selection',summary:'Find the right workspace and understand why an action may be unavailable.',icon:'admin_panel_settings',route:'/profile',steps:[
    'Use the branch selector in the top bar to choose your assigned hospital branch. Organisation administrators may use All branches for an overview.',
    'Choose a specific branch before creating or changing branch records. Access follows your current server assignment.',
    'Menu items and actions depend on your assigned role and permissions. Ask your hospital administrator to review an unavailable workspace.',
    'If a session expires, sign in again. Never share your password or include credentials in a support ticket.' ] },
  { id:'opd',category:'Clinical workflows',title:'Follow a patient through OPD',summary:'Move from appointment and check-in to consultation and prescription.',icon:'stethoscope',route:'/opd',steps:[
    'Register or find the patient in Patients, then schedule the appointment with the appropriate doctor.',
    'Use the appointment check-in action when the patient arrives. The consultation queue is available in OPD.',
    'Open the patient consultation, review the available history, and enter the clinical findings and orders.',
    'Review medication details before saving the prescription. Pharmacy handoff depends on your hospital’s OPD integration setting.',
    'Confirm saved records in the patient workspace. For a software issue, report the workflow step and time without copying patient-identifying details.' ] },
  { id:'ipd',category:'Clinical workflows',title:'Manage an IPD admission and discharge',summary:'Coordinate admissions, bed allocation, rounds and discharge readiness.',icon:'bed',route:'/ipd',steps:[
    'Open IPD and find the admission or start admission for an existing registered patient in the selected branch.',
    'Review the admission details and assign an available bed through the admission workspace.',
    'Use the patient workspace for vitals, doctor rounds and clinical orders. Check the focused work queues for pending tasks.',
    'Review discharge readiness and the outstanding operational tasks before completing discharge.',
    'Resolve conflicting bed or admission information through the responsible hospital team. Help Center is for software and workflow support, not clinical emergencies.' ] },
  { id:'billing',category:'Hospital operations',title:'Review charges, payments and billing documents',summary:'Keep billing work connected to the patient and saved payment records.',icon:'receipt_long',route:'/billing',steps:[
    'Open Billing for the selected branch and find the patient billing account or invoice.',
    'Review posted charges before adding a payment. Verify amount and payment method before saving.',
    'Use the document and print actions for saved invoices and receipts.',
    'For an unexpected charge, ask authorised billing staff to review the originating order and posted transaction. Do not repeat a payment to test whether it saved.' ] },
  { id:'lab',category:'Hospital operations',title:'Track laboratory work from order to result',summary:'Review the laboratory work queue and follow each processing stage.',icon:'biotech',route:'/laboratory',steps:[
    'Open Laboratory and find the order in the relevant work queue.',
    'Review patient and test details in the authorised clinical workspace before processing the sample.',
    'Record collection and processing actions through the laboratory workflow; enter and verify results with authorised staff.',
    'If an order or result is unavailable, check the selected branch and your role before creating a software ticket.' ] },
  { id:'pharmacy',category:'Hospital operations',title:'Dispense medication and check stock',summary:'Review prescriptions, quantities, batches and stock availability.',icon:'medication',route:'/pharmacy',steps:[
    'Find the prescription in Pharmacy and review the requested medication and remaining quantity.',
    'Use available eligible batches and verify stock before confirming dispensing.',
    'Partial dispensing keeps the remaining prescription quantity available for a later issue.',
    'Review the saved issue and billing result before retrying an interrupted action. For stock questions, reconcile receipts and issues through authorised staff.' ] },
  { id:'chat',category:'Working together',title:'Private chats, groups and unsent messages',summary:'Coordinate internally and recover safely after a connection interruption.',icon:'forum',route:'/chat',steps:[
    'Open Staff chat from the top bar. Choose a branch and use New chat for a private conversation or staff group.',
    'Group administrators can add colleagues, rename the group and promote another administrator before leaving.',
    'Queued messages are kept on the current device and retry automatically. Use the Unsent messages panel to review rejected items.',
    'A sent message has been saved on the server; a read receipt means a recipient advanced the conversation read cursor.',
    'Clearing browser data can remove unsent device messages. Keep clinical care decisions in the appropriate patient record.' ] },
  { id:'support',category:'Getting started',title:'Raise a useful support ticket',summary:'Give the hospital support team enough context to reproduce an issue.',icon:'support_agent',route:'/support',steps:[
    'Choose the affected branch, select New ticket, and provide a short title, category, module and priority.',
    'Describe what you expected, what happened, the workflow step, and the approximate time. Include a displayed error reference when available.',
    'Avoid patient names, medical records, passwords and other sensitive content. Attachments are not supported in this version.',
    'Track the ticket and reply in its activity timeline. The support team can assign it and record a resolution.',
    'Confirm the resolution by closing the ticket, or reopen a resolved or closed ticket if the software issue remains.' ] },
  { id:'inventory',category:'Hospital operations',title:'Receive and issue inventory',summary:'Follow purchase orders, actual receipts and branch stock movements.',icon:'inventory_2',route:'/inventory',steps:[
    'Create and review the purchase order, then approve it through authorised inventory staff.',
    'Record the quantity actually received. Partial receipts leave the remaining quantity outstanding.',
    'Issue stock through the inventory workspace after checking available quantities.',
    'Use the ledger to reconcile posted receipts and issues. Do not enter a second receipt simply because the first response was interrupted.' ] }
];
export const implementationTasks = [
  {id:'branches',title:'Confirm branches and departments',description:'Have your administrator review active branches and staff department assignments.',route:'/administration/branches'},
  {id:'staff',title:'Assign staff access',description:'Check user roles and branch assignments before staff begin daily work.',route:'/administration/users'},
  {id:'patients',title:'Review patient registration',description:'Walk through patient search and registration with reception staff.',route:'/patients'},
  {id:'opd',title:'Walk through OPD',description:'Review appointment, check-in and consultation responsibilities with the clinical team.',route:'/opd'},
  {id:'ipd',title:'Review IPD setup',description:'Confirm wards, rooms and beds, then review admission and discharge responsibilities.',route:'/ipd'},
  {id:'operations',title:'Verify billing, laboratory and pharmacy setup',description:'Ask each authorised team to review its catalogues and workflow settings.',route:'/billing'},
  {id:'handover',title:'Agree on the support process',description:'Identify hospital support managers and explain how staff should report software issues.',route:'/support'}
];
