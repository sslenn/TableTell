import { useState, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { ChatRequest, StreamEvent, ChatResponsePayload, StreamStatusStep } from '../types/api';

export interface UseChatStreamReturn {
  isStreaming: boolean;
  currentStep: StreamStatusStep | null;
  statusMessage: string;
  generatedSql: string | null;
  repairedSql: string | null;
  selfHealMessage: string | null;
  error: string | null;
  startStream: (
    req: ChatRequest,
    onComplete: (payload: ChatResponsePayload) => void
  ) => Promise<void>;
  resetStream: () => void;
}

export function useChatStream(): UseChatStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStep, setCurrentStep] = useState<StreamStatusStep | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [repairedSql, setRepairedSql] = useState<string | null>(null);
  const [selfHealMessage, setSelfHealMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetStream = useCallback(() => {
    setIsStreaming(false);
    setCurrentStep(null);
    setStatusMessage('');
    setGeneratedSql(null);
    setRepairedSql(null);
    setSelfHealMessage(null);
    setError(null);
  }, []);

  const startStream = useCallback(
    async (req: ChatRequest, onComplete: (payload: ChatResponsePayload) => void) => {
      resetStream();
      setIsStreaming(true);
      setCurrentStep('planning');
      setStatusMessage('Initializing LangGraph agent & DuckDB schema digest...');

      try {
        await fetchEventSource('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
          openWhenHidden: true,
          onmessage(msg) {
            if (!msg.data) return;

            try {
              const parsed = JSON.parse(msg.data);
              const eventType = msg.event as StreamEvent['event'];

              if (eventType === 'status') {
                setCurrentStep(parsed.step as StreamStatusStep);
                setStatusMessage(parsed.message);
              } else if (eventType === 'sql') {
                setGeneratedSql(parsed.sql);
                setCurrentStep('executing');
                setStatusMessage('SQL formulated. Executing against DuckDB columnar tables...');
              } else if (eventType === 'self_heal') {
                setCurrentStep('self_healing');
                setSelfHealMessage(parsed.message);
                setRepairedSql(parsed.repaired_sql);
                setStatusMessage(`Autonomously repairing query syntax (retry #${parsed.retry_count})...`);
              } else if (eventType === 'complete') {
                setCurrentStep('complete');
                setStatusMessage('Analysis complete.');
                setIsStreaming(false);
                onComplete(parsed);
              } else if (eventType === 'error') {
                setError(parsed.error);
                setIsStreaming(false);
              }
            } catch (err) {
              console.error('Failed to parse SSE event data', err);
            }
          },
          onerror(err) {
            console.error('SSE connection error:', err);
            setError(err instanceof Error ? err.message : 'Streaming connection failed.');
            setIsStreaming(false);
            throw err;
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to execute query stream.');
        setIsStreaming(false);
      }
    },
    [resetStream]
  );

  return {
    isStreaming,
    currentStep,
    statusMessage,
    generatedSql,
    repairedSql,
    selfHealMessage,
    error,
    startStream,
    resetStream
  };
}
