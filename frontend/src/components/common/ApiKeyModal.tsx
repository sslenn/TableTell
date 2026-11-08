import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Zap,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  Sparkles
} from 'lucide-react';
import {
  getCustomApiKey,
  setCustomApiKey,
  clearCustomApiKey,
  onCustomApiKeyChange
} from '../../lib/apiKeyStorage';
import { fetchQuotaStatus, verifyApiKey, type QuotaStatus } from '../../lib/api';
import { toast } from '../../store/useToastStore';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    valid?: boolean;
    provider?: string;
    message?: string;
    error?: string;
  } | null>(null);

  const activeKey = getCustomApiKey();

  // Load quota status whenever modal opens
  const refreshQuota = async () => {
    try {
      const q = await fetchQuotaStatus();
      setQuota(q);
    } catch {
      // Failed to load quota status (e.g. offline dev)
    }
  };

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(activeKey || '');
      setVerifyStatus(null);
      refreshQuota();
    }
  }, [isOpen]);

  useEffect(() => {
    return onCustomApiKeyChange(() => {
      refreshQuota();
    });
  }, []);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setVerifyStatus({ valid: false, error: 'Please enter a valid API key.' });
      return;
    }

    setVerifying(true);
    setVerifyStatus(null);

    try {
      const res = await verifyApiKey(trimmed);
      if (res.valid) {
        setCustomApiKey(trimmed);
        setVerifyStatus({
          valid: true,
          provider: res.provider || 'Google Gemini',
          message: 'Key verified and activated! Unlimited analysis unlocked.'
        });
        toast.success('BYOK Activated', 'Your custom API key has been verified and saved.');
        await refreshQuota();
      } else {
        setVerifyStatus({
          valid: false,
          error: res.error || 'Failed to verify key. Please ensure it is active.'
        });
      }
    } catch (err: any) {
      setVerifyStatus({
        valid: false,
        error: err.message || 'Verification failed. Please check your network connection.'
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveKey = async () => {
    clearCustomApiKey();
    setApiKeyInput('');
    setVerifyStatus(null);
    toast.info('Reverted to Server Quota', 'Removed custom API key. Free daily limits apply.');
    await refreshQuota();
  };

  const isByokActive = quota?.byok_active || Boolean(activeKey);
  const usedCount = quota?.used_today ?? 0;
  const limitCount = quota?.daily_limit ?? 20;
  const remainingCount = quota?.remaining ?? Math.max(0, limitCount - usedCount);
  const usagePct = Math.min(100, Math.round((usedCount / (limitCount || 1)) * 100));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--tt-border-strong)] bg-[var(--tt-bg-surface)] p-6 shadow-2xl flex flex-col gap-5 text-left text-xs animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--tt-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0D9488]/15 border border-[#0D9488]/30 text-[#0D9488]">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 id="api-key-modal-title" className="text-sm font-bold text-[var(--tt-text-primary)]">
                AI Engine & Quota Settings
              </h2>
              <p className="text-[11px] text-[var(--tt-text-muted)]">
                Bring Your Own Key (BYOK) or view daily free query limits
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-elevated)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Mode & Quota Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors ${
            isByokActive
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isByokActive ? (
                <>
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-emerald-400 text-xs uppercase tracking-wider">
                    BYOK Active · Unlimited Analysis
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#0D9488]" />
                  <span className="font-bold text-[var(--tt-text-primary)] text-xs">
                    Hosted Free Tier Quota
                  </span>
                </>
              )}
            </div>
            {isByokActive && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                {quota?.byok_key_preview || 'Custom Key'}
              </span>
            )}
          </div>

          {isByokActive ? (
            <div className="flex items-center justify-between text-[11px] text-[var(--tt-text-secondary)]">
              <span>All AI requests authenticate with your private API key directly. No server limits apply.</span>
              <button
                type="button"
                onClick={handleRemoveKey}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:underline cursor-pointer shrink-0 ml-3"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove Key</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-[var(--tt-text-secondary)] font-mono">
                <span>
                  {usedCount} of {limitCount} queries used today
                </span>
                <span className="font-bold text-[#0D9488]">
                  {remainingCount} remaining
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-[var(--tt-bg-surface)] overflow-hidden border border-[var(--tt-border-subtle)]">
                <div
                  className={`h-full transition-all duration-500 ${
                    usagePct >= 90
                      ? 'bg-red-500'
                      : usagePct >= 70
                      ? 'bg-amber-500'
                      : 'bg-[#0D9488]'
                  }`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--tt-text-muted)]">
                Quota resets daily at midnight UTC. Provide your own key below to analyze without daily limits.
              </p>
            </div>
          )}
        </div>

        {/* BYOK Configuration Form */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label htmlFor="byok-api-key" className="font-semibold text-[var(--tt-text-primary)]">
              Google Gemini API Key (Recommended)
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#0D9488] hover:text-[#2DD4BF] hover:underline"
            >
              <span>Get free key (30s)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative">
            <input
              id="byok-api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setVerifyStatus(null);
              }}
              placeholder="AIzaSy... (or sk-... for OpenAI)"
              className="w-full px-3 py-2.5 pr-10 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] text-xs text-[var(--tt-text-primary)] font-mono outline-none focus:border-[#0D9488] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] cursor-pointer"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Verification Feedback Banner */}
          {verifyStatus && (
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-[11px] ${
                verifyStatus.valid
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {verifyStatus.valid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span className="flex-1">{verifyStatus.message || verifyStatus.error}</span>
            </div>
          )}

          {/* Privacy & Engine Callout */}
          <div className="p-3 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)]/50 text-[11px] text-[var(--tt-text-muted)] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 leading-relaxed">
              <span className="text-[var(--tt-text-secondary)] font-semibold">
                Client-Side Storage & Zero Math Hallucination
              </span>
              <span>
                Your API key stays strictly in your browser's <code className="font-mono text-[#0D9488]">localStorage</code> and is transmitted securely over HTTPS solely to execute your queries. It is never logged or saved to a database.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--tt-border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-elevated)] text-[var(--tt-text-secondary)] font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSaveAndTest}
            disabled={verifying || !apiKeyInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white font-semibold cursor-pointer transition-all shadow-[var(--tt-shadow-card)]"
          >
            {verifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Test & Save Key</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
