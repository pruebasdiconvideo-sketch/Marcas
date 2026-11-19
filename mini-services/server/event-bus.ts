// Event bus pub/sub en memoria para push SSE a dashboards
type Handler = (data: any) => void;

class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  subscribe(event: string, handler: Handler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  publish(event: string, data: any): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) {
      try { h(data); } catch (e) { console.error("[EventBus]", e); }
    }
  }
}

export const eventBus = new EventBus();
