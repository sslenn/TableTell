import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { ChatRequest, StreamEvent, ChatResponsePayload, StreamStatusStep } from '../types/api';
import { getAuthToken, readErrorMessage } from '../lib/api';
import { getCustomApiKey, getClientId } from '../lib/apiKeyStorage';
import { logger } from '../lib/logger';

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
        const customKey = getCustomApiKey();
        if (customKey) {
          headers['X-Custom-AI-Key'] = customKey;
        }
        const clientId = getClientId();
        if (clientId) {
          headers['X-Client-Id'] = clientId;
        }

        await fetchEventSource('/api/chat/stream', {
          method: 'POST',
          headers,
          body: JSON.stringify(req),
          signal: controller.signal,
          openWhenHidden: true,
          async onopen(response) {
            const isEventStream = response.headers.get('content-type')?.includes('text/event-stream');
            if (response.ok && isEventStream) return;
            // Surface the server's reason (expired session, validation error) instead of a generic stream error.
            throw new Error(
              response.ok
                ? 'The server did not start the analysis stream. Try again.'
                : await readErrorMessage(response, 'The analysis could not start')
            );
          },
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
              logger.error('Failed to parse SSE event data', err);
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
            logger.error('SSE connection error', err);
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
        const errMsg = err instanceof Error ? err.message : 'Failed to execute query stream.';
        if (errMsg.includes('daily free limit') || errMsg.includes('429') || errMsg.includes('BYOK') || errMsg.includes('API key')) {
          window.dispatchEvent(new CustomEvent('open-api-key-modal'));
        }
        setError(errMsg);
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
