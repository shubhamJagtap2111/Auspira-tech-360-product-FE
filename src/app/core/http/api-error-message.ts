import { ApiResponse } from '../auth/auth.models';

const localizationKeyPattern = /^[A-Z][A-Za-z0-9]*(\.[A-Z][A-Za-z0-9]*)+$/;

export function getApiErrorMessage<T>(response: ApiResponse<T>, fallback = 'Request failed'): string {
  const detail = normalize(response.problem?.detail);
  if (detail && !isLocalizationKey(detail)) {
    return withCorrelation(detail, response);
  }

  const error = response.errors.find(item => normalize(item.localizationKey) && !isLocalizationKey(item.localizationKey))
    ?? response.errors.find(item => normalize(item.code) && !isLocalizationKey(item.code));
  const errorText = normalize(error?.localizationKey) || normalize(error?.code);
  if (errorText && !isLocalizationKey(errorText)) {
    return withCorrelation(errorText, response);
  }

  const message = normalize(response.message);
  if (message && !isLocalizationKey(message)) {
    return withCorrelation(message, response);
  }

  return withCorrelation(fallback, response);
}

function withCorrelation(message: string, response: ApiResponse<unknown>): string {
  const id = normalize(response.correlationId) || normalize(response.traceId) || normalize(response.requestId);
  return id ? `${message} (Correlation: ${id})` : message;
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isLocalizationKey(value: string): boolean {
  return localizationKeyPattern.test(value);
}
