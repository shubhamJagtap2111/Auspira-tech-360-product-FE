import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  /* ── Auth (no shell) ── */
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login-page.component').then(m => m.LoginPageComponent)
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./features/auth/register-page.component').then(m => m.RegisterPageComponent)
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

  /* ── App (wrapped in shell) ── */
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then(m => m.DashboardPageComponent)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile-page.component').then(m => m.ProfilePageComponent)
  },
  {
    path: 'patients',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/patients/patient-list-page.component').then(m => m.PatientListPageComponent)
  },
  {
    path: 'administration/users',
    canActivate: [authGuard, permissionGuard],
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
  moduleRoute('administration', 'Administration', ['Hospital Management', 'User Management', 'Role Management', 'Permission Management', 'Branch Management', 'Multilingual Seed Data']),
  moduleRoute('doctors',        'Doctor Management',    ['Doctor Profiles', 'Availability', 'Specialization', 'Schedule', 'Performance Dashboard']),
  moduleRoute('appointments',   'Appointment Management', ['Calendar View', 'Slot Booking', 'Walk-In Registration', 'Follow-Ups', 'Queue Management']),
  moduleRoute('opd',            'OPD',                  ['Symptoms', 'Diagnosis', 'Prescription', 'Consultation Notes', 'Attachments', 'Follow-Up Plan']),
  moduleRoute('ipd',            'IPD',                  ['Admission', 'Discharge', 'Ward Allocation', 'Bed Tracking', 'Nursing Notes', 'Treatment Plans']),
  moduleRoute('laboratory',     'Laboratory',           ['Test Master', 'Sample Collection', 'Result Entry', 'PDF Reports']),
  moduleRoute('pharmacy',       'Pharmacy',             ['Medicine Catalog', 'Stock Management', 'Purchase Entry', 'Sales Entry', 'Expiry Tracking', 'Low Stock Alerts']),
  moduleRoute('billing',        'Billing',              ['Invoices', 'Payments', 'Refunds', 'Insurance', 'Discounts']),
  moduleRoute('inventory',      'Inventory',            ['Assets', 'Medical Equipment', 'Consumables', 'Purchase Orders', 'Vendor Management']),
  moduleRoute('reports',        'Reports & Insights',   ['Dashboards', 'Revenue Insights', 'Appointment Reports', 'Inventory Reports', 'Doctor Performance'])
];

function moduleRoute(path: string, title: string, capabilities: string[]): Routes[number] {
  return {
    path,
    canActivate: [authGuard],
    data: { title, capabilities },
    loadComponent: () =>
      import('./features/workspace/module-workspace-page.component').then(m => m.ModuleWorkspacePageComponent)
  };
}
