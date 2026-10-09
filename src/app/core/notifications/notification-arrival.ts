import type { InboxItem } from './notification-inbox.service';

export interface NotificationArrival {
  sequence: number;
  count: number;
  title: string;
  critical: boolean;
}

/** Compare successful snapshots, independently of unread-count changes. */
export class NotificationArrivalTracker {
  private seen = new Set<string>();
  private initialized = false;
  private sequence = 0;

  reset(): void {
    this.seen.clear();
    this.initialized = false;
  }

  record(items: InboxItem[]): NotificationArrival | null {
    const incoming = items.filter(item => !item.readAt && !this.seen.has(item.id));
    for (const item of items) this.seen.add(item.id);
    if (!this.initialized) {
      this.initialized = true;
      return null;
    }
    if (!incoming.length) return null;
    const critical = incoming.some(item => item.priority === 'CRITICAL');
    return {
      sequence: ++this.sequence,
      count: incoming.length,
      title: (incoming.find(item => item.priority === 'CRITICAL') ?? incoming[0]).title,
      critical
    };
  }
}
