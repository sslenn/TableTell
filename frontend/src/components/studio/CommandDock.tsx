import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  MicOff,
  RotateCcw,
  Zap,
  Columns3,
  Sparkles,
  AlertCircle,
  TrendingUp,
  BarChart2,
  AlertTriangle,
  Award,
  Layers
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { toast } from '../../store/useToastStore';

interface CommandDockProps {
  isStreaming: boolean;
  onSubmitQuery: (query: string) => void;
  onResetChat: () => void;
  onToggleSchema?: () => void;
  isSchemaOpen?: boolean;
}

export const CommandDock: React.FC<CommandDockProps> = ({
  isStreaming,
  onSubmitQuery,
  onResetChat,
  onToggleSchema,
  isSchemaOpen
}) => {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    datasetId,
    activeColumns,
    suggestedPrompt,
    setSuggestedPrompt
  } = useAppStore();

  // Populate query when an external suggestion is clicked
  useEffect(() => {
    if (suggestedPrompt) {
      setQuery(suggestedPrompt);
      setSuggestedPrompt('');
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [suggestedPrompt, setSuggestedPrompt]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [query]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isStreaming) return;
    onSubmitQuery(query.trim());
    setQuery('');
  };

  const handleApplyTemplate = (template: string) => {
    setQuery(template);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleMicToggle = () => {
    setSpeechError(null);
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void;
        start: () => void;
      };
    };

    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please type.');
      toast.warning('Speech Unsupported', 'Browser speech recognition is not available');
      setTimeout(() => setSpeechError(null), 4000);
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('Listening...', 'Speak your analytical question');
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => {
        setIsListening(false);
        setSpeechError('Could not capture audio. Please check microphone permissions.');
        toast.error('Microphone Error', 'Check permissions and try again');
        setTimeout(() => setSpeechError(null), 4000);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        setQuery(transcript);
        setIsListening(false);
        toast.success('Voice Transcribed', `"${transcript}"`);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechError('Microphone initialization failed.');
      setTimeout(() => setSpeechError(null), 4000);
    }
  };

  const quickTemplates = [
    { label: 'Top 10 Ranking', icon: Award, template: 'Show the top 10 records ordered by ' },
    { label: 'Category Breakdown', icon: BarChart2, template: 'Compare total revenue and row counts across categories' },
    { label: 'Time Trend', icon: TrendingUp, template: 'Show the weekly or monthly trend over time with a chart' },
    { label: 'Statistical Summary', icon: Layers, template: 'Calculate statistical summary (mean, median, min, max) for ' }
  ];

  return (
    <div
      className="rounded-2xl border p-3.5 transition-all duration-200 relative shadow-2xl focus-within:border-[#2DD4BF] focus-within:ring-2 focus-within:ring-[#2DD4BF]/20"
      style={{
        backgroundColor: 'var(--tt-bg-surface)',
        borderColor: 'var(--tt-border-strong)',
        boxShadow: 'var(--tt-shadow-floating)'
      }}
    >
      {/* Speech Error Banner */}
      {speechError && (
        <div
          className="mb-2 p-2 rounded-lg border text-xs flex items-center gap-2 font-medium"
          style={{
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            borderColor: 'var(--tt-error)',
            color: 'var(--tt-error)'
          }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Reset Confirmation Bar */}
      {showConfirmReset && (
        <div
          className="mb-2.5 p-2.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in"
          style={{
            backgroundColor: 'rgba(251, 146, 60, 0.12)',
            borderColor: 'var(--tt-accent-warm)',
            color: 'var(--tt-text-primary)'
          }}
        >
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 text-[#FB923C]" />
            <span>Clear analytical conversation history?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onResetChat();
                setShowConfirmReset(false);
                toast.info('Chat Reset', 'Conversation history cleared');
              }}
              className="px-2.5 py-1 rounded bg-[#FB923C] text-black font-bold text-xs cursor-pointer hover:opacity-90"
            >
              Confirm Clear
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmReset(false)}
              className="px-2 py-1 rounded border text-xs cursor-pointer opacity-70 hover:opacity-100"
              style={{ borderColor: 'var(--tt-border-subtle)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={`Ask a question about '${datasetId}' (e.g. 'Compare revenue by category and show weekly trend')...`}
            rows={1}
            className="w-full resize-none bg-transparent outline-none text-sm placeholder:opacity-50 selection:bg-[#2DD4BF]/20 max-h-32 leading-relaxed"
            style={{
              color: 'var(--tt-text-primary)'
            }}
          />

          {isListening && (
            <div className="absolute right-2 top-2 flex items-center gap-1.5 text-xs text-[#F87171] font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#F87171]" />
              <span>Listening...</span>
            </div>
          )}
        </div>

        {/* Quick Query Templates */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] font-mono font-medium opacity-60 mr-1" style={{ color: 'var(--tt-text-muted)' }}>
            Analytical Shortcuts:
          </span>
          {quickTemplates.map((tpl, i) => {
            const Icon = tpl.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleApplyTemplate(tpl.template)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono border cursor-pointer transition-all hover:border-[#2DD4BF] hover:text-[#2DD4BF] group"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-secondary)'
                }}
              >
                <Icon className="w-2.5 h-2.5 text-[#2DD4BF] opacity-70 group-hover:opacity-100" />
                <span>{tpl.label}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom Toolbar & Action Bar */}
        <div
          className="flex flex-wrap items-center justify-between pt-2.5 border-t gap-2 select-none"
          style={{ borderColor: 'var(--tt-border-subtle)' }}
        >
          {/* Active Dataset Pill & Column Helper */}
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border"
              style={{
                backgroundColor: 'var(--tt-bg-elevated)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-primary)'
              }}
            >
              <Zap className="w-3 h-3 text-[#2DD4BF]" />
              <span className="font-semibold">{datasetId}</span>
            </span>

            {onToggleSchema && (
              <button
                type="button"
                onClick={onToggleSchema}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors hover:border-[#2DD4BF]"
                style={{
                  backgroundColor: isSchemaOpen ? 'var(--tt-primary-subtle)' : 'var(--tt-bg-elevated)',
                  borderColor: isSchemaOpen ? 'var(--tt-primary)' : 'var(--tt-border-subtle)',
                  color: isSchemaOpen ? 'var(--tt-primary)' : 'var(--tt-text-secondary)'
                }}
                title="Toggle schema columns inspector"
              >
                <Columns3 className="w-3 h-3" />
                <span>Schema ({activeColumns.length} cols)</span>
              </button>
            )}

            <span className="hidden sm:inline-block text-[10px] font-mono opacity-50" style={{ color: 'var(--tt-text-muted)' }}>
              ↵ Run · ⇧↵ New Line
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfirmReset(true)}
              title="Reset conversation history"
              className="p-1.5 rounded-lg border transition-all cursor-pointer opacity-80 hover:opacity-100 hover:border-[#2DD4BF]"
              style={{
                backgroundColor: 'var(--tt-bg-elevated)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-text-secondary)'
              }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleMicToggle}
              title={isListening ? 'Stop listening' : 'Dictate query with voice'}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isListening ? 'text-[#F87171] border-[#F87171] animate-pulse' : 'text-secondary hover:border-[#2DD4BF]'
              }`}
              style={{
                backgroundColor: 'var(--tt-bg-elevated)',
                borderColor: isListening ? '#F87171' : 'var(--tt-border-subtle)',
                color: isListening ? '#F87171' : 'var(--tt-text-secondary)'
              }}
            >
              {isListening ? <MicOff className="w-4 h-4 text-[#F87171]" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="submit"
              disabled={!query.trim() || isStreaming}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-semibold text-xs tracking-wide transition-all cursor-pointer disabled:opacity-40 hover:opacity-95 shadow-md"
              style={{
                backgroundColor: 'var(--tt-primary)',
                color: '#0A1214',
                boxShadow: '0 2px 12px var(--tt-primary-subtle)'
              }}
            >
              {isStreaming ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <span>Run Query</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
