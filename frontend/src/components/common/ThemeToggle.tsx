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
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 cursor-pointer"
      style={{
        backgroundColor: 'var(--tt-bg-elevated)',
        borderColor: 'var(--tt-border-subtle)',
        color: 'var(--tt-text-secondary)'
      }}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
    >
      {isDark ? (
        <>
          <Moon className="w-3.5 h-3.5 text-[#2DD4BF]" />
          <span>Dark</span>
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-[#EA580C]" />
          <span>Light</span>
        </>
      )}
    </button>
  );
};
