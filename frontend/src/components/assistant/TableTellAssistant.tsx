import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Minus,
  Trash2,
  Send,
  GripHorizontal,
  Lightbulb,
  CheckCircle2
} from 'lucide-react';
import { useDraggable } from '../../hooks/useDraggable';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import type { AssistantMessage } from '../../types/assistant';

const QUICK_PROMPTS = [
  'Explain 1.5x IQR outliers',
  'How does data cleaning work?',
  'What is the Health Score?',
  'Nominal vs. Ordinal categorical',
  'Why use Parquet over CSV?'
];

export const TableTellAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const collapsedSize = 68;
  const chatWidth = 380;
  const chatHeight = 520;

  const {
    position,
    setPosition,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleSafeClick,
    isDragging
  } = useDraggable({
    width: isOpen ? chatWidth : collapsedSize,
    height: isOpen ? chatHeight : collapsedSize,
    defaultWidth: chatWidth,
    defaultHeight: chatHeight,
    storageKey: 'tabletell_copilot_orb_pos',
    margin: 12
  });

  // When opening, ensure the 380x520 window fits cleanly within the screen
  useEffect(() => {
    if (isOpen) {
      const margin = 12;
      const maxX = Math.max(margin, window.innerWidth - chatWidth - margin);
      const maxY = Math.max(margin, window.innerHeight - chatHeight - margin);
      setPosition((prev) => ({
        x: Math.min(Math.max(margin, prev.x), maxX),
        y: Math.min(Math.max(margin, prev.y), maxY)
      }));
    }
  }, [isOpen, setPosition]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Load message history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/assistant/history');
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            // Initial greeting message
            setMessages([
              {
                id: 'welcome_1',
                role: 'assistant',
                content: (
                  "👋 **Hello! I'm your TableTell Copilot.**\n\n" +
                  "I'm here to help you navigate TableTell and explain statistical or data engineering concepts!\n\n" +
                  "You can ask me anything about:\n" +
                  "- **IQR & Outlier detection** (numeric & categorical)\n" +
                  "- **TableTell's 5-dimension Health Score**\n" +
                  "- **Approval-based cleaning pipelines & versioning**\n" +
                  "- **Variable types (Nominal, Ordinal, Continuous)**\n\n" +
                  "Click one of the suggested prompts below or ask any question!"
                ),
                created_at: new Date().toISOString()
              }
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load assistant history', err);
      }
    };
    fetchHistory();
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    setInputText('');
    const userMsgId = `usr_${Date.now()}`;
    const optimisticUserMsg: AssistantMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: AssistantMessage = {
        id: data.message_id || `asst_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        created_at: data.created_at || new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: '⚠️ Failed to reach assistant service. Please check your network or server connection.',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await fetch('/api/assistant/history', { method: 'DELETE' });
      setMessages([
        {
          id: `rst_${Date.now()}`,
          role: 'assistant',
          content: '✨ History cleared! What would you like to explore next?',
          created_at: new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.error('Failed to clear assistant history', err);
    }
  };

  return (
    <>
      {/* 1. COLLAPSED FLOATING CYBER-ORB BOT (UNWRAPPED, NO NAME, DRAGGABLE TO EVERY CORNER) */}
      {!isOpen && (
        <div
          className="fixed z-50 select-none group touch-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${collapsedSize}px`,
            height: `${collapsedSize}px`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => handleSafeClick(() => setIsOpen(true))}
          title="TableTell Copilot (Click to open, drag to any corner)"
        >
          <div className="relative w-full h-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105 active:scale-95">
            {/* Ambient Multi-Ring Orbital Glow (matching cyber-orb rings from second picture) */}
            <div className="absolute -inset-2 rounded-full border border-teal-400/25 pointer-events-none animate-pulse" />
            <div className="absolute -inset-1 rounded-full border border-teal-300/35 pointer-events-none" />
            <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-xl group-hover:bg-teal-400/40 transition-all duration-300 pointer-events-none" />

            {/* Glowing Cyber-Orb Bot Avatar Directly */}
            <img
              src="/tabletell-avatar.png"
              alt="TableTell Copilot"
              className="relative w-full h-full object-contain rounded-full select-none pointer-events-none drop-shadow-[0_0_18px_rgba(45,212,191,0.65)]"
              draggable={false}
            />

            {/* Online Green Beacon */}
            <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-[#10B981] ring-2 ring-[var(--tt-bg-canvas)] shadow-[0_0_8px_#10B981] pointer-events-none animate-pulse" />
          </div>
        </div>
      )}

      {/* 2. EXPANDED DRAGGABLE CHAT WINDOW */}
      {isOpen && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl select-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: '380px',
            height: '520px',
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: isDragging ? 'var(--tt-primary)' : 'var(--tt-border-strong)',
            boxShadow: '0 16px 48px -4px rgba(0, 0, 0, 0.5), 0 0 24px -2px rgba(45, 212, 191, 0.2)'
          }}
        >
          {/* Header Bar with Drag Handle */}
          <div
            className="flex items-center justify-between px-3.5 py-2.5 border-b cursor-grab active:cursor-grabbing transition-colors touch-none"
            style={{
              backgroundColor: 'var(--tt-bg-elevated)',
              borderColor: 'var(--tt-border-subtle)'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="w-4 h-4 text-[var(--tt-text-muted)]" />
              <img
                src="/tabletell-avatar.png"
                alt="TableTell"
                className="w-4 h-4 rounded-full object-contain"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold font-mono text-[var(--tt-text-primary)]">
                  TableTell Copilot
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" title="Online & Grounded" />
              </div>
            </div>

            <div
              className="flex items-center gap-1"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleClearHistory}
                title="Clear Conversation History"
                className="p-1 rounded-md text-[var(--tt-text-muted)] hover:text-[#F87171] hover:bg-[var(--tt-bg-surface)] transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize Copilot"
                className="p-1 rounded-md text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-surface)] transition-all cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1 rounded-md text-[var(--tt-text-muted)] hover:text-[#F87171] hover:bg-[var(--tt-bg-surface)] transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Conversation Messages Container */}
          <div
            className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 text-xs scrollbar-thin select-text"
            style={{ backgroundColor: 'var(--tt-bg-canvas)' }}
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1 max-w-[92%] ${
                    isUser ? 'self-end' : 'self-start'
                  }`}
                >
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl ${
                      isUser
                        ? 'bg-[var(--tt-primary)] text-slate-950 font-medium rounded-br-xs'
                        : 'border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] text-[var(--tt-text-primary)] rounded-bl-xs'
                    }`}
                    style={
                      !isUser
                        ? {
                            boxShadow: 'var(--tt-shadow-card)'
                          }
                        : {}
                    }
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <MarkdownRenderer content={msg.content} className="text-xs" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-[var(--tt-text-muted)] px-1">
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] self-start text-[11px] font-mono text-[var(--tt-text-muted)]">
                <span className="w-2 h-2 rounded-full bg-[#2DD4BF] animate-ping" />
                <span>Copilot is formulating explanation...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div
            className="p-2 border-t flex items-center gap-1.5 overflow-x-auto scrollbar-none"
            style={{
              backgroundColor: 'var(--tt-bg-surface)',
              borderColor: 'var(--tt-border-subtle)'
            }}
          >
            <Lightbulb className="w-3.5 h-3.5 text-[#FB923C] shrink-0 ml-1" />
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-full border text-[10px] font-mono whitespace-nowrap transition-all cursor-pointer hover:border-[#2DD4BF] hover:text-[#2DD4BF] disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-secondary)'
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Dock */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 border-t flex flex-col gap-1.5"
            style={{
              backgroundColor: 'var(--tt-bg-elevated)',
              borderColor: 'var(--tt-border-subtle)'
            }}
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about data knowledge or TableTell..."
                disabled={isLoading}
                className="flex-1 bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--tt-text-primary)] placeholder-[var(--tt-text-muted)] focus:outline-none focus:border-[#2DD4BF] font-sans transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="p-2 rounded-xl bg-[var(--tt-primary)] text-slate-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#14B8A6] cursor-pointer"
                title="Send Question"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--tt-text-muted)] px-1">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#34D399]" />
                <span>Gemini Flash Grounded</span>
              </span>
              <span className="opacity-70">Drag header to reposition</span>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
