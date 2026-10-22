export interface ChatRequest {
  dataset_id: string;
  query: string;
  max_retries?: number;
}

export interface TableResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  duration_ms?: number;
}

export interface ChatResponsePayload {
  status: 'success' | 'error';
  summary: string;
  sql: string;
  plotly_spec: Record<string, unknown> | null;
  table: TableResult;
  self_healed: boolean;
  retries: number;
}

export type StreamStatusStep = 'planning' | 'generating_sql' | 'executing' | 'self_healing' | 'complete';

export interface StreamStatusEvent {
  step: StreamStatusStep;
  message: string;
}

export interface StreamSqlEvent {
  sql: string;
}

export interface StreamSelfHealEvent {
  message: string;
  repaired_sql: string;
  retry_count: number;
}

export type StreamEvent =
  | { event: 'status'; data: StreamStatusEvent }
  | { event: 'sql'; data: StreamSqlEvent }
  | { event: 'self_heal'; data: StreamSelfHealEvent }
  | { event: 'complete'; data: ChatResponsePayload }
  | { event: 'error'; data: { error: string } };

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sql?: string;
  plotly_spec?: Record<string, unknown> | null;
  table?: TableResult;
  self_healed?: boolean;
  retries?: number;
}
