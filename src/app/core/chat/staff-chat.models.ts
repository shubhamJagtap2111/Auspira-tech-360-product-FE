export interface ChatStaff { userId: string; name: string; department: string; role: string; }
export interface ChatMember extends ChatStaff { lastReadSequence: number; available: boolean; }
export interface ChatConversation {
  id: string; branchCode: string; kind: 'DIRECT' | 'GROUP'; title: string; updatedAt: string;
  lastSequence: number; lastReadSequence: number; myRole: string; memberCount: number;
  unreadCount: number; lastMessage: string; lastSenderName: string;
}
export interface ChatMessage {
  id: string; conversationId: string; sequence: number; senderId: string; senderName: string;
  clientMessageId: string; body: string; createdAt: string; recipientCount: number; deliveredCount: number; readCount: number;
}
export interface QueuedChatMessage {
  id: string; scope: string; conversationId: string; conversationTitle: string; senderId: string;
  body: string; createdAt: string; attempts: number; nextAttemptAt: number; state: 'queued' | 'failed'; error: string;
}
export interface ChatResponse<T> { success: boolean; data: T | null; statusCode?: number; message?: string; }
export interface ChatMessagePage { items: ChatMessage[]; hasMore: boolean; }
export type ChatReceipt = Pick<ChatMessage, 'id' | 'recipientCount' | 'deliveredCount' | 'readCount'>;
export function chatReceiptState(message: ChatReceipt): 'sent' | 'delivered' | 'read' {
  if (message.recipientCount > 0 && message.readCount >= message.recipientCount) return 'read';
  if (message.recipientCount > 0 && Math.max(message.deliveredCount, message.readCount) >= message.recipientCount) return 'delivered';
  return 'sent';
}
export function mergeChatReceipts(messages: ChatMessage[], receipts: ChatReceipt[]): ChatMessage[] {
  const updates = new Map(receipts.map(receipt => [receipt.id, receipt]));
  return messages.map(message => {
    const receipt = updates.get(message.id);
    return receipt ? { ...message, recipientCount: receipt.recipientCount,
      deliveredCount: Math.max(message.deliveredCount, receipt.deliveredCount), readCount: Math.max(message.readCount, receipt.readCount) } : message;
  });
}

export function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const key = (message: ChatMessage) => `${message.senderId}|${message.clientMessageId}`;
  const messages = new Map(existing.map(message => [key(message), message]));
  for (const message of incoming) messages.set(key(message), message);
  return [...messages.values()].sort((a, b) => a.sequence - b.sequence);
}
export function retryDelay(attempts: number, jitter = Math.random()): number {
  return Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6)) + Math.round(jitter * 1000);
}
export function retryableChatFailure(status?: number): boolean {
  return status === undefined || status === 0 || status === 408 || status === 429 || status >= 500;
}
