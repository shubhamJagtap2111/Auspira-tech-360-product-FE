import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiResponse } from '../auth/auth.models';
import { ApiClientService } from '../http/api-client.service';
import { REQUEST_TIMEOUT_MS, SKIP_GLOBAL_LOADER } from '../interceptors/loader.interceptor';

export interface AiraChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface AiraChatResponse {
  message: string;
  provider: string;
  model: string;
  generatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AiraChatService {
  private readonly api = inject(ApiClientService);

  send(message: string, history: AiraChatMessage[]): Promise<ApiResponse<AiraChatResponse>> {
    return firstValueFrom(this.api.post<ApiResponse<AiraChatResponse>>('/ai/chat', {
      message,
      history
    }, {
      context: new HttpContext()
        .set(SKIP_GLOBAL_LOADER, true)
        .set(REQUEST_TIMEOUT_MS, 22_000)
    }));
  }
}
