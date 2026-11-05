// Local development always uses the dev-server proxy, never the deployed API.
export const environment = {
  apiBaseUrl: '/api/v1'
} as const;
