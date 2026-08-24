import { CurrentUserProfile } from './auth.models';

export function buildProfileImageUrl(profile: CurrentUserProfile | null | undefined, apiBaseUrl: string): string {
  if (!profile) {
    return '';
  }

  const path = profile.profileImagePath?.trim();
  if (!path) {
    return '';
  }

  if (/^https?:\/\//i.test(path)) {
    return appendImageVersion(path, profile);
  }

  const apiRoot = apiBaseUrl.replace(/\/api\/v\d+\/?$/i, '');
  const normalizedPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return appendImageVersion(`${apiRoot}/${normalizedPath}`, profile);
}

function appendImageVersion(url: string, profile: CurrentUserProfile): string {
  const version = encodeURIComponent(profile.modifiedDate ?? profile.rowVersion ?? '');
  if (!version) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}v=${version}`;
}
