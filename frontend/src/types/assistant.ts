export interface AssistantMessage {
  id: string;
  conversation_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used?: number;
  created_at: string;
}

export interface AssistantChatRequest {
  query: string;
  conversation_id?: string;
}

export interface AssistantChatResponse {
  status: 'success' | 'error';
  reply: string;
  message_id: string;
  conversation_id: string;
  created_at: string;
}
