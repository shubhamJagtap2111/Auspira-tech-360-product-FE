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

  /* ── App (wrapped in shell) ── */
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
  {
    path: 'super-admin',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/super-admin-dashboard-page.component').then(m => m.SuperAdminDashboardPageComponent)
  },
  {
    path: 'super-admin/tenants',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/tenant-management-page.component').then(m => m.TenantManagementPageComponent)
  },
  {
    path: 'super-admin/plans',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/plan-management-page.component').then(m => m.PlanManagementPageComponent)
  },
  {
    path: 'super-admin/provisioning',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/tenant-provisioning-page.component').then(m => m.TenantProvisioningPageComponent)
  },
  {
    path: 'super-admin/features',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/feature-catalog-page.component').then(m => m.FeatureCatalogPageComponent)
  },
  {
    path: 'super-admin/subscriptions',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/subscription-management-page.component').then(m => m.SubscriptionManagementPageComponent)
  },
  {
    path: 'super-admin/billing',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/billing-management-page.component').then(m => m.BillingManagementPageComponent)
  },
  {
    path: 'super-admin/databases',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/database-management-page.component').then(m => m.DatabaseManagementPageComponent)
  },
  {
    path: 'super-admin/monitoring',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/monitoring-page.component').then(m => m.MonitoringPageComponent)
  },
  {
    path: 'super-admin/support',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/support-center-page.component').then(m => m.SupportCenterPageComponent)
  },
  {
    path: 'super-admin/notifications',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/notification-center-page.component').then(m => m.NotificationCenterPageComponent)
  },
  {
    path: 'super-admin/settings',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'Administration.Dashboard.View' },
    loadComponent: () =>
      import('./features/super-admin/global-settings-page.component').then(m => m.GlobalSettingsPageComponent)
  },
  moduleRoute('super-admin/announcements', 'Announcements', ['Application Updates', 'Maintenance', 'Renewal Reminders', 'Email', 'SMS', 'Push', 'WhatsApp']),
  moduleRoute('super-admin/domains', 'Tenant Domains', ['Primary Domain', 'Custom Domains', 'Verification', 'SSL Status']),
  moduleRoute('super-admin/database-servers', 'Database Servers', ['Provider', 'Region', 'Capacity', 'Health']),
  moduleRoute('super-admin/database-versions', 'Database Versions', ['Schema Version', 'Migration Status', 'Backup Version']),
  moduleRoute('super-admin/deployments/releases', 'Deployment Releases', ['Release Notes', 'Artifacts', 'Versions']),
  moduleRoute('super-admin/deployments/rollouts', 'Deployment Rollouts', ['Phased Rollout', 'Tenant Selection', 'Progress']),
  moduleRoute('super-admin/deployments/rollbacks', 'Deployment Rollbacks', ['Rollback Plan', 'Previous Version', 'Audit']),
  moduleRoute('super-admin/security/api-keys', 'API Keys', ['Key Registry', 'Scopes', 'Rotation']),
  moduleRoute('super-admin/security/sessions', 'Sessions', ['Active Sessions', 'Revocation', 'Device Tracking']),
  moduleRoute('super-admin/security/audit-logs', 'Audit Logs', ['Actor', 'Entity', 'Action', 'Timeline']),
  moduleRoute('super-admin/support/feedback', 'Feedback', ['Hospitals', 'Sentiment', 'Priority', 'Follow Up']),
  moduleRoute('super-admin/reports/revenue', 'Revenue Reports', ['MRR', 'Invoices', 'Payments', 'Growth']),
  moduleRoute('super-admin/reports/hospitals', 'Hospital Reports', ['Registrations', 'Status', 'Plan Mix']),
  moduleRoute('super-admin/reports/growth', 'Growth Reports', ['New Hospitals', 'Trials', 'Conversions']),
  moduleRoute('super-admin/reports/usage', 'Usage Reports', ['Users', 'Storage', 'Requests']),
  moduleRoute('super-admin/reports/ai-consumption', 'AI Consumption Reports', ['AI Credits', 'Requests', 'Cost']),
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
