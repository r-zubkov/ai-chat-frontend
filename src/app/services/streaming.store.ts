import { computed, Injectable, signal } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class StreamingStore {
  private _content = signal<Map<string, string>>(new Map());

  content = computed(() => this._content());

  set(id: string, message: string) {
    this._content.update(map => {
      map.set(id, message);
      return new Map(map);
    });
  }

  get(id: string) {
    return this._content().get(id) ?? '';
  }

  remove(id: string) {
    this._content.update(map => {
      map.delete(id);
      return new Map(map);
    });
  }
}