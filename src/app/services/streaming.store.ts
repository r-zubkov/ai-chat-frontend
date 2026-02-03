import { computed, signal } from "@angular/core";

export class StreamingStore {
  private _content = signal<Map<string, string>>(new Map());

  content = computed(() => this._content());

  set(id: string, message: string): void {
    this._content.update(map => {
      map.set(id, message);
      return new Map(map);
    });
  }

  get(id: string): string {
    return this._content().get(id) ?? '';
  }

  remove(id: string): void {
    this._content.update(map => {
      map.delete(id);
      return new Map(map);
    });
  }
}