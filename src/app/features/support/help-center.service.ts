import { inject, Injectable } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { SKIP_GLOBAL_LOADER } from '../../core/interceptors/loader.interceptor';
import { HelpDetail, HelpResponse, HelpWorkspace, TicketDraft } from './help-center.models';

@Injectable({ providedIn: 'root' })
export class HelpCenterService {
  private readonly api = inject(ApiClientService);
  private readonly options = { context: new HttpContext().set(SKIP_GLOBAL_LOADER,true) };
  workspace(query: URLSearchParams) { return firstValueFrom(this.api.get<HelpResponse<HelpWorkspace>>('/support?' + query, this.options)); }
  detail(id: string) { return firstValueFrom(this.api.get<HelpResponse<HelpDetail>>(`/support/tickets/${id}`, this.options)); }
  create(draft: TicketDraft) { return firstValueFrom(this.api.post<HelpResponse<{id:string}>>('/support/tickets', draft, this.options)); }
  reply(id: string, requestId: string, body: string) { return firstValueFrom(this.api.post<HelpResponse<unknown>>(`/support/tickets/${id}/replies`, {requestId,body}, this.options)); }
  update(id: string, request: {requestId:string; version:number; status:string; priority:string; assigneeId:string|null; resolution:string}) {
    return firstValueFrom(this.api.post<HelpResponse<unknown>>(`/support/tickets/${id}/status`, request, this.options));
  }
}
