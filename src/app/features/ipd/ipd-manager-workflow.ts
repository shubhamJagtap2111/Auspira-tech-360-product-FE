import type { IpdAdmissionListItem, IpdBedStatus, IpdDashboard } from './ipd-management.models';

export interface ManagerTask {
  key: string; title: string; detail: string; action: string; icon: string; kind: 'admit' | 'bed' | 'discharge' | 'lab' | 'clean'; urgent: boolean;
  admission?: IpdAdmissionListItem; bed?: IpdBedStatus;
}

export type IpdWorkFocus = 'ward' | 'doctor' | 'nursing';
export type IpdPatientView = 'all' | 'needs-bed' | 'investigations' | 'discharge';

export function matchesIpdPatientView(patient: IpdAdmissionListItem, view: IpdPatientView): boolean {
  if (view === 'needs-bed') return !patient.bedNo?.trim();
  if (view === 'investigations') return patient.activeOrders > 0;
  if (view === 'discharge') return patient.statusCode.toUpperCase() === 'DISCHARGE_INITIATED';
  return true;
}

/** Work focus changes presentation only. It does not grant clinical permissions. */
export function ipdTasksForFocus(tasks: ManagerTask[], focus: IpdWorkFocus): ManagerTask[] {
  if (focus === 'doctor') return tasks.filter(task => task.kind === 'lab' || task.kind === 'discharge');
  if (focus === 'nursing') return tasks.filter(task => ['bed', 'lab', 'discharge'].includes(task.kind));
  return tasks;
}

export function sortIpdPatients(patients: IpdAdmissionListItem[], focus: IpdWorkFocus): IpdAdmissionListItem[] {
  const rank = (patient: IpdAdmissionListItem) => {
    const urgent = ['CRITICAL', 'EMERGENCY', 'URGENT'].includes(patient.priorityCode?.toUpperCase()) ? 1 : 0;
    return focus === 'ward' ? Number(!patient.bedNo?.trim()) * 4 + Number(matchesIpdPatientView(patient, 'discharge')) * 2 + urgent : urgent * 4 + Number(patient.activeOrders > 0) * 2;
  };
  return [...patients].sort((a, b) => rank(b) - rank(a) || a.wardName.localeCompare(b.wardName) || a.bedNo.localeCompare(b.bedNo, undefined, { numeric: true }) || a.patientName.localeCompare(b.patientName));
}

export function buildIpdManagerTasks(model: IpdDashboard | null): ManagerTask[] {
    if (!model) return [];
    const tasks: ManagerTask[] = [];
    for (const admission of model.admissions) {
      if (['DRAFT', 'PENDING_ADMISSION'].includes(admission.statusCode)) tasks.push({ key: 'admit-' + admission.admissionId, title: admission.patientName, detail: 'Admission waiting to be completed', action: 'Continue admission', icon: 'person_add', admission, kind: 'admit', urgent: false });
    }
    for (const admission of model.activePatients) {
      if (!admission.bedNo) tasks.push({ key: 'bed-' + admission.admissionId, title: admission.patientName, detail: 'Admitted patient needs a bed', action: 'Assign bed', icon: 'bed', admission, kind: 'bed', urgent: true });
      if (admission.statusCode === 'DISCHARGE_INITIATED') tasks.push({ key: 'discharge-' + admission.admissionId, title: admission.patientName, detail: 'Discharge preparation in progress', action: 'Prepare discharge', icon: 'logout', admission, kind: 'discharge', urgent: false });
      if (admission.activeOrders > 0) tasks.push({ key: 'lab-' + admission.admissionId, title: admission.patientName, detail: admission.activeOrders + ' pending investigations', action: 'Review', icon: 'science', admission, kind: 'lab', urgent: false });
    }
    for (const bed of model.beds.filter(item => item.statusCode === 'CLEANING')) tasks.push({ key: 'clean-' + bed.bedId, title: bed.wardName + ' · ' + bed.bedNo, detail: 'Awaiting cleaning completion', action: 'Mark clean & ready', icon: 'cleaning_services', bed, kind: 'clean', urgent: false });
    return tasks.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}
