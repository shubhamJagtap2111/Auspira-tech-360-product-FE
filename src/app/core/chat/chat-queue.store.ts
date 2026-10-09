import { QueuedChatMessage } from './staff-chat.models';

/** Complete the IndexedDB transaction before acknowledging an enqueue or removal. */
export class ChatQueueStore {
  private database?: Promise<IDBDatabase>;
  private open(): Promise<IDBDatabase> {
    return this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('care360.staff-chat', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('outbox', { keyPath: 'id' });
        request.result.createObjectStore('drafts', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); this.database = undefined; };
        resolve(request.result);
      };
      request.onerror = () => { this.database = undefined; reject(request.error); };
      request.onblocked = () => { this.database = undefined; reject(new Error('Close another older chat tab and try again.')); };
    });
  }
  private async transaction<T>(store: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(store, mode, { durability: mode === 'readwrite' ? 'strict' : 'default' });
      const request = action(tx.objectStore(store));
      let result: T;
      request.onsuccess = () => result = request.result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? request.error ?? new Error('Chat storage unavailable.'));
      tx.onabort = () => reject(tx.error ?? new Error('Chat storage interrupted.'));
    });
  }
  async list(scope: string): Promise<QueuedChatMessage[]> {
    const items = await this.transaction<QueuedChatMessage[]>('outbox', 'readonly', store => store.getAll());
    return items.filter(item => item.scope === scope).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }
  async save(item: QueuedChatMessage): Promise<void> { await this.transaction('outbox', 'readwrite', store => store.put(item)); }
  async remove(id: string): Promise<void> { await this.transaction('outbox', 'readwrite', store => store.delete(id)); }
  async draft(scope: string, conversationId: string): Promise<string> {
    const value = await this.transaction<{ id: string; text: string } | undefined>('drafts', 'readonly', store => store.get(scope + '|' + conversationId));
    return value?.text ?? '';
  }
  async saveDraft(scope: string, conversationId: string, text: string): Promise<void> {
    const id = scope + '|' + conversationId;
    if (text) await this.transaction('drafts', 'readwrite', store => store.put({ id, text }));
    else await this.transaction('drafts', 'readwrite', store => store.delete(id));
  }
}
