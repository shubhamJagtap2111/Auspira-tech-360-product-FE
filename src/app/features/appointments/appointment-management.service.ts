import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { AppointmentApiResponse, AppointmentCheckInForm, AppointmentForm, AppointmentQueueRecord, AppointmentRecord } from './appointment-management.models';

@Injectable({ providedIn: 'root' })
export class AppointmentManagementService {
  private readonly api = inject(ApiClientService);

  list(pageNumber = 1, pageSize = 100): Promise<AppointmentApiResponse<AppointmentRecord[]>> {
    return firstValueFrom(this.api.get<AppointmentApiResponse<AppointmentRecord[]>>(`/appointments?pageNumber=${pageNumber}&pageSize=${pageSize}`));
  }

  create(form: AppointmentForm): Promise<AppointmentApiResponse<AppointmentRecord>> {
    return firstValueFrom(this.api.post<AppointmentApiResponse<AppointmentRecord>>('/appointments', createPayload(form)));
  }

  update(form: AppointmentForm): Promise<AppointmentApiResponse<AppointmentRecord>> {
    return firstValueFrom(this.api.put<AppointmentApiResponse<AppointmentRecord>>(`/appointments/${form.appointmentId}`, createPayload(form)));
  }

  updateRecord(appointment: AppointmentRecord): Promise<AppointmentApiResponse<AppointmentRecord>> {
    return firstValueFrom(this.api.put<AppointmentApiResponse<AppointmentRecord>>(`/appointments/${appointment.id}`, createRecordPayload(appointment)));
  }

  updateStatus(appointment: AppointmentRecord, statusCode: string): Promise<AppointmentApiResponse<AppointmentRecord>> {
    return firstValueFrom(this.api.put<AppointmentApiResponse<AppointmentRecord>>(`/appointments/${appointment.id}`, createRecordPayload({ ...appointment, statusCode })));
  }

  listQueue(pageNumber = 1, pageSize = 100): Promise<AppointmentApiResponse<AppointmentQueueRecord[]>> {
    return firstValueFrom(this.api.get<AppointmentApiResponse<AppointmentQueueRecord[]>>(`/queue?pageNumber=${pageNumber}&pageSize=${pageSize}`));
  }

  createQueue(form: AppointmentCheckInForm): Promise<AppointmentApiResponse<AppointmentQueueRecord>> {
    return firstValueFrom(this.api.post<AppointmentApiResponse<AppointmentQueueRecord>>('/queue', createQueuePayload(form)));
  }

  updateQueue(form: AppointmentCheckInForm): Promise<AppointmentApiResponse<AppointmentQueueRecord>> {
    return firstValueFrom(this.api.put<AppointmentApiResponse<AppointmentQueueRecord>>(`/queue/${form.queueId}`, createQueuePayload(form)));
  }
}

function createPayload(form: AppointmentForm) {
  return {
    id: form.appointmentId || undefined,
    appointmentNo: form.appointmentNo || createAppointmentNo(),
    patientId: form.patientId,
    doctorId: form.doctorId,
    startsAt: toIsoDateTime(form.appointmentDate, form.appointmentTime),
    appointmentType: form.appointmentType || 'NEW_CONSULTATION',
    branchName: form.branchName.trim() || 'Main Branch',
    departmentName: form.departmentName.trim() || null,
    statusCode: form.statusCode || 'SCHEDULED',
    reason: form.reason.trim() || null,
    notes: form.notes.trim() || null
  };
}

function createRecordPayload(appointment: AppointmentRecord) {
  return {
    id: appointment.id,
    appointmentNo: appointment.appointmentNo,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    startsAt: appointment.startsAt,
    appointmentType: appointment.appointmentType,
    branchName: appointment.branchName,
    departmentName: appointment.departmentName,
    statusCode: appointment.statusCode,
    reason: appointment.reason,
    notes: appointment.notes
  };
}

function toIsoDateTime(date: string, time: string): string {
  return new Date(`${date}T${time || '09:00'}`).toISOString();
}

function createAppointmentNo(): string {
  return `APT-${Date.now().toString(36).toUpperCase()}`;
}

function createQueuePayload(form: AppointmentCheckInForm) {
  return {
    id: form.queueId || undefined,
    appointmentId: form.appointmentId,
    queueNo: form.queueNo,
    tokenNumber: form.tokenNumber.trim(),
    arrivedAt: toIsoDateTime(form.arrivalDate, form.arrivalTime),
    priorityCode: form.priorityCode || 'NORMAL',
    statusCode: 'WAITING',
    notes: form.notes.trim() || null
  };
}
