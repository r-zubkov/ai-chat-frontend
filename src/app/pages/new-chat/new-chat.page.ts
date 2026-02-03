import { Component, OnInit } from '@angular/core';
import { ChatInput } from '../../components/chat-input/chat-input';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-new-chat.page',
  imports: [ChatInput],
  templateUrl: './new-chat.page.html',
  styleUrl: './new-chat.page.less',
})
export class NewChatPage implements OnInit {
  constructor(private readonly chatService: ChatService) {}
  
  ngOnInit(): void {
    this.chatService.initializeChat(null)
  }

  protected sendRequest(text: string): void {
    this.chatService.sendMessage(
      text, [], {
        onSend: (msg) => this.chatService.navigateToChat(msg.chatId),
        onFinish: (msg) => {},
        onError: (err) => console.error('Error sending message:', err)
      }
    )
  }
}
