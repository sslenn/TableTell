import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useAppStore();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 hover:border-[var(--tt-border-strong)]"
      style={{
        backgroundColor: 'var(--tt-bg-surface)',
        borderColor: 'var(--tt-border-subtle)',
        color: 'var(--tt-text-secondary)'
      }}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
    >
      {isDark ? (
        <Moon className="w-3.5 h-3.5 text-[#2DD4BF]" />
      ) : (
        <Sun className="w-3.5 h-3.5 text-[#EA580C]" />
      )}
    </button>
  );
};
