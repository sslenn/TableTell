export interface AssistantMessage {
  id: string;
  conversation_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used?: number;
  created_at: string;
}

export interface AssistantContext {
  current_tab?: string;
  dataset_id?: string;
  dataset_name?: string;
  health_score?: number;
  total_rows?: number;
  columns?: string[];
  audit_summary?: Record<string, any>;
}

export interface AssistantChatRequest {
  query: string;
  conversation_id?: string;
  context?: AssistantContext;
}

export interface AssistantChatResponse {
  status: 'success' | 'error';
  reply: string;
  message_id: string;
  conversation_id: string;
  created_at: string;
}
