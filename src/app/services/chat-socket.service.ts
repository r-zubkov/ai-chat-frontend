import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Observer } from 'rxjs';
import { ChatMessage } from '../models/chat.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private socket: Socket;

  // все активные запросы на клиенте: requestId -> observer
  private activeRequests = new Map<string, Observer<string>>();

  constructor() {
    this.socket = io(environment.apiUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[socket] connected', this.socket.id);
    });

    this.socket.on('reconnect', (attempt) => {
      console.log('[socket] reconnected, attempt', attempt);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[socket] disconnected:', reason);

      // Если во время дисконнекта были активные запросы —
      // считаем, что они упали с ошибкой (для ChatState.ERROR)
      if (this.activeRequests.size > 0) {
        for (const observer of this.activeRequests.values()) {
          observer.error(new Error('Socket disconnected'));
        }
        this.activeRequests.clear();
      } else {
        // Просто лог, если запросов не было
        console.log('[socket] disconnected with no active requests');
      }
    });

    this.socket.on('connect_error', (err) => {
      console.error('[socket] connect_error', err);
    });
  }

  /**
   * Стримит ответ от модели.
   * Возвращаем и requestId, и Observable, чтобы можно было отменять по ID.
   */
  sendChatCompletion(
    model: string,
    messages: ChatMessage[],
  ): { requestId: string; stream$: Observable<string> } {
    const requestId = crypto.randomUUID();

    const stream$ = new Observable<string>((observer) => {
      // сохраняем observer, чтобы при disconnect/abort можно было его дёрнуть
      this.activeRequests.set(requestId, observer);

      const onChunk = (data: { requestId: string; delta: string }) => {
        if (data.requestId !== requestId) return;
        observer.next(data.delta);
      };

      const onDone = (data: { requestId: string; aborted?: boolean }) => {
        if (data.requestId !== requestId) return;
        cleanup();
        observer.complete();
      };

      const onError = (data: { requestId: string; error: string }) => {
        if (data.requestId !== requestId) return;
        cleanup();
        observer.error(new Error(data.error));
      };

      const cleanup = () => {
        this.socket.off('chat:chunk', onChunk);
        this.socket.off('chat:done', onDone);
        this.socket.off('chat:error', onError);
        this.activeRequests.delete(requestId);
      };

      this.socket.on('chat:chunk', onChunk);
      this.socket.on('chat:done', onDone);
      this.socket.on('chat:error', onError);

      this.socket.emit('chat:request', {
        requestId,
        model,
        messages,
      });

      // teardown — если отписались вручную от Observable
      return () => {
        cleanup();
        // чтобы не висел на сервере, шлём abort
        this.socket.emit('chat:abort', { requestId });
      };
    });

    return { requestId, stream$ };
  }

  /**
   * Явная отмена одного запроса (по кнопке "Стоп", например).
   * Это НЕ ошибка, поэтому observer.complete().
   */
  abortRequest(requestId: string): void {
    const observer = this.activeRequests.get(requestId);
    if (!observer) return;

    this.socket.emit('chat:abort', { requestId });
    this.activeRequests.delete(requestId);
    observer.complete();
  }

  /**
   * Отменить все активные запросы (если хочешь "global stop").
   */
  abortAllRequests(): void {
    for (const [requestId, observer] of this.activeRequests.entries()) {
      this.socket.emit('chat:abort', { requestId });
      observer.complete();
    }
    this.activeRequests.clear();
  }
}
