import { AuthResponse } from './auth.models';

const platformRoleCodes = new Set([
  'AUSPIRA_SUPER_ADMIN',
  'PLATFORM_SUPER_ADMIN',
  'SOFTWARE_SUPER_ADMIN',
  'SUPER_ADMIN'
]);

const hospitalAdminRoleCodes = new Set([
  'HOSPITAL_ADMIN'
]);

const roleLabels: Record<string, string> = {
  HOSPITAL_ADMIN: 'Hospital Admin',
  DATA_ENTRY_OPERATOR: 'Data Entry Operator',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist',
  LAB_TECHNICIAN: 'Lab Technician',
  BILLING_OPERATOR: 'Billing Operator',
  INVENTORY_MANAGER: 'Inventory Manager'
};

const hospitalAdminPermissionPrefixes = [
  'Administration.Hospital.',
  'Administration.Branch.',
  'Administration.Roles.',
  'Administration.Permissions.',
  'Administration.SystemConfiguration.'
];

const hospitalAdminPermissionCodes = new Set([
  'Administration.UserManagement.Create',
  'Administration.UserManagement.Edit',
  'Administration.UserManagement.Delete',
  'Administration.UserManagement.AssignRoles',
  'Administration.Department.Create',
  'Administration.Department.Edit',
  'Administration.Department.Delete',
  'Administration.Designation.Create',
  'Administration.Designation.Edit',
  'Administration.Designation.Delete'
]);

export function getSessionRoleCodes(session: AuthResponse | null): string[] {
  return (session?.roleCodes ?? [])
    .map(role => role.trim().toUpperCase())
    .filter(Boolean);
}

export function isPlatformUser(session: AuthResponse | null): boolean {
  const roleCodes = getSessionRoleCodes(session);
  if (roleCodes.some(role => platformRoleCodes.has(role) || role.includes('SUPER_ADMIN'))) {
    return true;
  }

  return (session?.permissions ?? []).some(permission => permission.startsWith('SuperAdmin.'));
}

export function isHospitalAdminUser(session: AuthResponse | null): boolean {
  if (isPlatformUser(session)) {
    return false;
  }

  const roleCodes = getSessionRoleCodes(session);
  if (roleCodes.length > 0) {
    return roleCodes.some(role => hospitalAdminRoleCodes.has(role));
  }

  const permissions = session?.permissions ?? [];
  return permissions.some(permission => hospitalAdminPermissionPrefixes.some(prefix => permission.startsWith(prefix)))
    || permissions.some(permission => hospitalAdminPermissionCodes.has(permission));
}

export function getUserRoleLabel(session: AuthResponse | null): string {
  if (isPlatformUser(session)) {
    return 'Auspira Super Admin';
  }

  const roleCodes = getSessionRoleCodes(session);
  const knownRole = roleCodes.find(role => roleLabels[role]);
  if (knownRole) {
    return roleLabels[knownRole];
  }

  if (isHospitalAdminUser(session)) {
    return 'Hospital Admin';
  }

  const permissions = session?.permissions ?? [];
  if (permissions.some(permission => permission.startsWith('Clinical.'))) {
    return 'Clinical User';
  }

  if (permissions.some(permission => permission.startsWith('Operations.'))) {
    return 'Operations User';
  }

  if (permissions.some(permission => permission.startsWith('Administration.'))) {
    return 'Hospital Staff';
  }

  return 'User';
}
