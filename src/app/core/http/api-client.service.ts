import { HttpClient } from '@angular/common/http';
import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './api-endpoints';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string, options?: ApiRequestOptions) {
    return this.http.get<T>(`${this.baseUrl}${path}`, { withCredentials: true, ...options });
  }

  post<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, { withCredentials: true, ...options });
  }

  put<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, { withCredentials: true, ...options });
  }

  patch<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, { withCredentials: true, ...options });
  }

  delete<T>(path: string, options?: ApiRequestOptions) {
    return this.http.delete<T>(`${this.baseUrl}${path}`, { withCredentials: true, ...options });
  }
}

interface ApiRequestOptions {
  context?: HttpContext;
}
