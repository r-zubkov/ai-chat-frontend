import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

interface TimewebChoice {
  message: {
    role: 'assistant' | 'user' | 'system';
    content: string;
  };
}

interface TimewebResponse {
  choices: TimewebChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  sendChatCompletion(
    model: string,
    messages: { role: string; content: string }[],
    stream = false,
  ): Observable<string> {
    return this.http
      .post<TimewebResponse>(`${this.baseUrl}/chat`, {
        model,
        messages,
        stream,
      })
      .pipe(
        map((response) => {
          const choice = response.choices?.[0];
          return choice?.message?.content ?? '';
        }),
      );
  }
}
