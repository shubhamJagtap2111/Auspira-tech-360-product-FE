export interface HelpTicket {
  id: string; ticketNo: string; branchCode: string; requesterId: string; requesterName: string;
  title: string; description: string; category: string; module: string; priority: string; status: string;
  assigneeId: string | null; assigneeName: string; resolution: string; version: number;
  createdAt: string; updatedAt: string; resolvedAt: string | null;
}
export interface HelpActivity { id: string; actorId: string; actorName: string; kind: string; body: string; createdAt: string; }
export interface HelpContact { userId: string; name: string; department: string; }
export interface HelpWorkspace { summary: { open: number; priority: number; completedToday: number }; canManage: boolean; tickets: HelpTicket[]; contacts: HelpContact[]; total: number; page: number; pageSize: number; }
export interface HelpDetail { ticket: HelpTicket; activities: HelpActivity[]; }
export interface HelpResponse<T> { success: boolean; data: T | null; statusCode?: number; message?: string; problem?: { detail?: string }; }
export interface TicketDraft { requestId: string; title: string; description: string; category: string; module: string; priority: string; }
export function ticketTransitions(status: string): string[] {
  return ({ OPEN: ['OPEN','IN_PROGRESS','WAITING','RESOLVED'], IN_PROGRESS: ['IN_PROGRESS','WAITING','RESOLVED'], WAITING: ['WAITING','IN_PROGRESS','RESOLVED'], RESOLVED: ['RESOLVED','CLOSED','OPEN'], CLOSED: ['CLOSED','OPEN'] } as Record<string,string[]>)[status] ?? [];
}
export function validTicket(draft: TicketDraft): boolean {
  return draft.title.trim().length >= 5 && draft.title.trim().length <= 160 && draft.description.trim().length >= 10 && draft.description.trim().length <= 8000;
}
