import type { HospitalProfile } from './hospital-management.models';

export type HospitalSaveSection = 'profile' | 'branding' | 'settings';
const profileFields = ['hospitalCode', 'hospitalName', 'legalName', 'shortName', 'websiteUrl', 'establishedDate', 'primaryLanguageCode', 'timeZoneCode', 'currencyCode', 'address', 'contact', 'license', 'gst', 'subscription'] as const;

/** Apply only the saved section, preserving unrelated drafts and edits made in flight. */
export function mergeHospitalSave(current: HospitalProfile, submitted: HospitalProfile, saved: HospitalProfile, section: HospitalSaveSection): HospitalProfile {
  const merged = { ...current, modifiedDate: saved.modifiedDate, rowVersion: saved.rowVersion };
  const target = merged as unknown as Record<string, unknown>;
  const fields = section === 'profile' ? profileFields : [section] as const;
  for (const field of fields) target[field] = mergeValue(current[field], submitted[field], saved[field]);
  return merged;
}

function mergeValue(current: unknown, submitted: unknown, saved: unknown): unknown {
  if (JSON.stringify(current) === JSON.stringify(submitted)) return saved;
  if (isObject(current) && isObject(submitted) && isObject(saved)) {
    const merged = { ...current };
    for (const key of Object.keys(saved)) merged[key] = mergeValue(current[key], submitted[key], saved[key]);
    return merged;
  }
  return current;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function hasHospitalDraft(current: HospitalProfile | null, saved: HospitalProfile | null): boolean {
  return !!current && !!saved && [...profileFields, 'branding', 'settings'].some(field =>
    JSON.stringify(current[field as keyof HospitalProfile]) !== JSON.stringify(saved[field as keyof HospitalProfile]));
}
