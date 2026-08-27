import { HttpClient } from '@angular/common/http';
import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, of, timeout } from 'rxjs';
import { REQUEST_TIMEOUT_MS } from '../interceptors/loader.interceptor';
import { API_BASE_URL } from './api-endpoints';

const API_REQUEST_TIMEOUT_MS = 20000;

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string, options?: ApiRequestOptions) {
    return this.http.get<T>(`${this.baseUrl}${path}`, { withCredentials: true, ...options })
      .pipe(timeout(requestTimeout(options)), catchError(error => of(toApiErrorResponse<T>(error))));
  }

  post<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, { withCredentials: true, ...options })
      .pipe(timeout(requestTimeout(options)), catchError(error => of(toApiErrorResponse<T>(error))));
  }

  put<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, { withCredentials: true, ...options })
      .pipe(timeout(requestTimeout(options)), catchError(error => of(toApiErrorResponse<T>(error))));
  }

  patch<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, { withCredentials: true, ...options })
      .pipe(timeout(requestTimeout(options)), catchError(error => of(toApiErrorResponse<T>(error))));
  }

  delete<T>(path: string, options?: ApiRequestOptions) {
    return this.http.delete<T>(`${this.baseUrl}${path}`, { withCredentials: true, ...options })
      .pipe(timeout(requestTimeout(options)), catchError(error => of(toApiErrorResponse<T>(error))));
  }
}

interface ApiRequestOptions {
  context?: HttpContext;
}

function requestTimeout(options?: ApiRequestOptions): number {
  return options?.context?.get(REQUEST_TIMEOUT_MS) || API_REQUEST_TIMEOUT_MS;
}

function toApiErrorResponse<T>(error: unknown): T {
  const responseBody = readErrorBody(error);
  if (isApiResponse(responseBody)) {
    return responseBody as T;
  }

  if (isTimeoutError(error)) {
    return {
      success: false,
      statusCode: 408,
      message: 'Common.Errors.RequestTimeout',
      data: null,
      errors: [],
      correlationId: null,
      timestamp: new Date().toISOString(),
      traceId: null,
      requestId: null,
      problem: null
    } as T;
  }

  const statusCode = readStatusCode(error);
  return {
    success: false,
    statusCode,
    message: statusCode === 0 ? 'Common.Errors.NetworkUnavailable' : 'Common.Errors.UnhandledException',
    data: null,
    errors: [],
    correlationId: null,
    timestamp: new Date().toISOString(),
    traceId: null,
    requestId: null,
    problem: null
  } as T;
}

function readErrorBody(error: unknown): unknown {
  if (!error || typeof error !== 'object' || !('error' in error)) {
    return null;
  }

  const body = (error as { error?: unknown }).error;
  if (typeof body !== 'string') {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function isTimeoutError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: unknown }).name === 'TimeoutError');
}

function readStatusCode(error: unknown): number {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return 500;
  }

  const status = Number((error as { status?: unknown }).status);
  return Number.isFinite(status) ? status : 500;
}

function isApiResponse(value: unknown): value is { success: boolean; statusCode: number; message: string } {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'success' in value &&
    'statusCode' in value &&
    'message' in value);
}
