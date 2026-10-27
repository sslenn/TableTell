import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { ChatRequest, StreamEvent, ChatResponsePayload, StreamStatusStep } from '../types/api';
import { getAuthToken } from '../lib/api';

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
  cancelStream: () => void;
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

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cancel any active stream on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const resetStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setCurrentStep(null);
    setStatusMessage('');
    setGeneratedSql(null);
    setRepairedSql(null);
    setSelfHealMessage(null);
    setError(null);
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setCurrentStep(null);
    setStatusMessage('Analysis stopped by user.');
  }, []);

  const startStream = useCallback(
    async (req: ChatRequest, onComplete: (payload: ChatResponsePayload) => void) => {
      // Abort any existing stream before starting a new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      resetStream();
      setIsStreaming(true);
      setCurrentStep('planning');
      setStatusMessage('Initializing LangGraph agent & DuckDB schema digest...');

      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        await fetchEventSource('/api/chat/stream', {
          method: 'POST',
          headers,
          body: JSON.stringify(req),
          signal: controller.signal,
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
                abortControllerRef.current = null;
                onComplete(parsed);
              } else if (eventType === 'error') {
                setError(parsed.error);
                setIsStreaming(false);
                abortControllerRef.current = null;
              }
            } catch (err) {
              console.error('Failed to parse SSE event data', err);
            }
          },
          onclose() {
            setIsStreaming(false);
            abortControllerRef.current = null;
          },
          onerror(err) {
            if (controller.signal.aborted) {
              // Expected user abort; do not retry, do not set error state
              throw err;
            }
            console.error('SSE connection error:', err);
            setError(err instanceof Error ? err.message : 'Streaming connection failed.');
            setIsStreaming(false);
            abortControllerRef.current = null;
            throw err;
          }
        });
      } catch (err) {
        if (controller.signal.aborted) {
          // Normal abort triggered by user cancel
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to execute query stream.');
        setIsStreaming(false);
        abortControllerRef.current = null;
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
    cancelStream,
    resetStream
  };
}
