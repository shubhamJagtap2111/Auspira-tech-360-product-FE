const localApiBaseUrl = 'https://localhost:44392/api/v1';
const deployedApiBaseUrl = 'https://auspira-tech-360-product-api.onrender.com/api/v1';

function isLocalFrontendHost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

export const environment = {
  apiBaseUrl: isLocalFrontendHost() ? localApiBaseUrl : deployedApiBaseUrl
} as const;
