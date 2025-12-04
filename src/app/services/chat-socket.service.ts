import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Observer } from 'rxjs';
import { ChatMessage } from '../models/chat.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private socket: Socket | null = null;

  // все активные запросы на клиенте: requestId -> observer
  private readonly activeRequests = new Map<string, Observer<string>>();

  // состояние подключения для UI
  readonly connected = signal(false);

  constructor() {
    this.initSocket();
  }

  private initSocket(): void {
    this.socket = io(environment.apiUrl, {
      transports: ['websocket'],
      path: '/api/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[socket] connected', this.socket?.id);
      this.connected.set(true);
    });

    this.socket.on('reconnect', (attempt) => {
      console.log('[socket] reconnected, attempt', attempt);
      this.connected.set(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[socket] disconnected:', reason);
      this.connected.set(false);

      // Все активные запросы считаем упавшими
      for (const observer of this.activeRequests.values()) {
        observer.error(new Error('Socket disconnected'));
      }
      this.activeRequests.clear();
    });

    this.socket.on('connect_error', (err) => {
      console.error('[socket] connect_error', err);
      this.connected.set(false);
    });

    // --- Централизованные обработчики чатов ---

    this.socket.on('chat:chunk', (data: ChatChunkPayload) => {
      const observer = this.activeRequests.get(data.requestId);
      observer?.next(data.delta);
    });

    this.socket.on('chat:done', (data: ChatDonePayload) => {
      const observer = this.activeRequests.get(data.requestId);
      if (!observer) return;

      this.activeRequests.delete(data.requestId);
      observer.complete();
    });

    this.socket.on('chat:error', (data: ChatErrorPayload) => {
      const observer = this.activeRequests.get(data.requestId);
      if (!observer) return;

      this.activeRequests.delete(data.requestId);
      observer.error(new Error(data.error));
    });
  }

  /**
   * Стримит ответ от модели.
   * Возвращаем requestId + Observable, чтобы можно было отменять по ID.
   */
  sendChatCompletion(
    model: string,
    messages: ChatMessage[],
  ): { requestId: string; stream$: Observable<string> } {
    const requestId = crypto.randomUUID();

    const stream$ = new Observable<string>((observer) => {
      // Если сокет не подключён — сразу фейлим observable
      if (!this.socket || !this.socket.connected) {
        observer.error(new Error('Socket is not connected'));
        return;
      }

      // Регистрируем активный запрос
      this.activeRequests.set(requestId, observer);

      // Отправляем запрос на сервер
      this.socket.emit('chat:request', {
        requestId,
        model,
        messages,
      });

      // teardown — если отписались вручную
      return () => {
        const current = this.activeRequests.get(requestId);

        // Отменяем только если этот observer ещё актуален
        if (current === observer) {
          this.activeRequests.delete(requestId);
          this.socket?.emit('chat:abort', { requestId });
        }
      };
    });

    return { requestId, stream$ };
  }

  /**
   * Явная отмена одного запроса
   */
  abortRequest(requestId: string): void {
    const observer = this.activeRequests.get(requestId);
    if (!observer) return;

    this.socket?.emit('chat:abort', { requestId });
    this.activeRequests.delete(requestId);
    observer.complete();
  }

  /**
   * Отменить все активные запросы
   */
  abortAllRequests(): void {
    for (const requestId of Array.from(this.activeRequests.keys())) {
      this.abortRequest(requestId);
    }
  }

  /**
   * Явное завершение жизни сервиса
   */
  destroy(): void {
    this.abortAllRequests();
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }
}
