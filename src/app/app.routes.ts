import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { pendingChangesGuard } from './core/guards/pending-changes.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login-page.component').then(m => m.LoginPageComponent)
  },
  {
    path: 'auth/google-callback',
    loadComponent: () =>
      import('./features/auth/google-callback-page.component').then(m => m.GoogleCallbackPageComponent)
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password-page.component').then(m => m.ForgotPasswordPageComponent)
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password-page.component').then(m => m.ResetPasswordPageComponent)
  },
  {
    path: 'auth/verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email-page.component').then(m => m.VerifyEmailPageComponent)
  },
  {
    path: 'auth/change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password-page.component').then(m => m.ChangePasswordPageComponent)
  },
  {
    path: '',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then(m => m.DashboardPageComponent)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile-page.component').then(m => m.ProfilePageComponent)
  },
  profileActionRoute('profile/account-settings', 'account'),
  profileActionRoute('profile/security-settings', 'security'),
  profileActionRoute('profile/activity-logs', 'activity'),
  profileActionRoute('profile/change-password', 'password'),
  {
    path: 'patients/:patientGuid',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Patients.View' },
    loadComponent: () =>
      import('./features/patients/patient-profile-page.component').then(m => m.PatientProfilePageComponent)
  },
  {
    path: 'patients',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Patients.View' },
    loadComponent: () =>
      import('./features/patients/patient-list-page.component').then(m => m.PatientListPageComponent)
  },
  {
    path: 'doctors/:doctorGuid',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Doctors.View' },
    loadComponent: () =>
      import('./features/doctors/doctor-profile-page.component').then(m => m.DoctorProfilePageComponent)
  },
  {
    path: 'doctors',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Doctors.View' },
    loadComponent: () =>
      import('./features/doctors/doctor-list-page.component').then(m => m.DoctorListPageComponent)
  },
  {
    path: 'appointments',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Appointments.View' },
    loadComponent: () =>
      import('./features/appointments/appointment-page.component').then(m => m.AppointmentPageComponent)
  },
  {
    path: 'administration/users',
    canActivate: [authGuard, permissionGuard],
    canDeactivate: [pendingChangesGuard],
    data: { permission: 'Administration.UserManagement.View' },
    loadComponent: () =>
      import('./features/administration/users/user-list-page.component').then(m => m.UserListPageComponent)
  },
  {
    path: 'administration/roles',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Roles.View' },
    loadComponent: () =>
      import('./features/administration/rbac/role-management-page.component').then(m => m.RoleManagementPageComponent)
  },
  {
    path: 'administration/permissions',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Permissions.View' },
    loadComponent: () =>
      import('./features/administration/rbac/permission-matrix-page.component').then(m => m.PermissionMatrixPageComponent)
  },
  {
    path: 'administration/hospital',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Hospital.View' },
    loadComponent: () =>
      import('./features/administration/hospital/hospital-management-page.component').then(m => m.HospitalManagementPageComponent)
  },
  {
    path: 'administration/branches',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Branch.View' },
    loadComponent: () =>
      import('./features/administration/branches/branch-management-page.component').then(m => m.BranchManagementPageComponent)
  },
  {
    path: 'administration/departments',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Department.View' },
    loadComponent: () =>
      import('./features/administration/organization/department-management-page.component').then(m => m.DepartmentManagementPageComponent)
  },
  {
    path: 'administration/designations',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Designation.View' },
    loadComponent: () =>
      import('./features/administration/organization/designation-management-page.component').then(m => m.DesignationManagementPageComponent)
  },
  {
    path: 'administration/system-configuration',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.SystemConfiguration.View' },
    loadComponent: () =>
      import('./features/administration/system-configuration/system-configuration-page.component').then(m => m.SystemConfigurationPageComponent)
  },
  moduleRoute('administration', 'Administration', ['Hospital Management', 'User Management', 'Role Management', 'Permission Management', 'Branch Management', 'Localization']),
  {
    path: 'opd',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/opd/opd-page.component').then(m => m.OpdPageComponent)
  },
  {
    path: 'ipd',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/ipd/ipd-page.component').then(m => m.IpdPageComponent)
  },
  moduleRoute('emergency', 'Emergency', ['Emergency Triage', 'Critical Queue', 'Ambulance Intake', 'Bed Escalation', 'Incident Notes']),
  {
    path: 'laboratory',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Laboratory.View' },
    loadComponent: () =>
      import('./features/laboratory/laboratory-page.component').then(m => m.LaboratoryPageComponent)
  },
  moduleRoute('pharmacy', 'Pharmacy', ['Medicine Catalog', 'Stock Management', 'Purchase Entry', 'Sales Entry', 'Expiry Tracking', 'Low Stock Alerts']),
  {
    path: 'billing',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Billing.View' },
    loadComponent: () =>
      import('./features/billing/billing-page.component').then(m => m.BillingPageComponent)
  },
  moduleRoute('inventory', 'Inventory', ['Assets', 'Medical Equipment', 'Consumables', 'Purchase Orders', 'Vendor Management']),
  {
    path: 'reports/mis',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Reports.View' },
    loadComponent: () =>
      import('./features/reports/mis-reports-page.component').then(m => m.MisReportsPageComponent)
  },
  {
    path: 'quality',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Reports.View' },
    loadComponent: () =>
      import('./features/quality/quality-indicators-page.component').then(m => m.QualityIndicatorsPageComponent)
  },
  {
    path: 'reports',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Reports.View' },
    loadComponent: () =>
      import('./features/reports/reports-insights-page.component').then(m => m.ReportsInsightsPageComponent)
  },
  moduleRoute('support', 'Help Center', ['Tickets', 'Knowledge Base', 'Implementation Help', 'Contact Support']),
  moduleRoute('documentation', 'Documentation', ['User Guides', 'Workflow Manuals', 'Release Notes', 'API Reference']),
  { path: '**', redirectTo: '' }
];

function profileActionRoute(path: string, mode: string): Routes[number] {
  return {
    path,
    canActivate: [authGuard],
    data: { mode },
    loadComponent: () =>
      import('./features/profile/profile-action-page.component').then(m => m.ProfileActionPageComponent)
  };
}

function moduleRoute(path: string, title: string, capabilities: string[]): Routes[number] {
  return {
    path,
    canActivate: [authGuard],
    data: { title, capabilities },
    loadComponent: () =>
      import('./features/workspace/module-workspace-page.component').then(m => m.ModuleWorkspacePageComponent)
  };
}
