import type { IpdAdmissionListItem, IpdBedStatus, IpdDashboard } from './ipd-management.models';

export interface ManagerTask {
  key: string; title: string; detail: string; action: string; icon: string; kind: 'admit' | 'bed' | 'discharge' | 'lab' | 'clean'; urgent: boolean;
  admission?: IpdAdmissionListItem; bed?: IpdBedStatus;
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
