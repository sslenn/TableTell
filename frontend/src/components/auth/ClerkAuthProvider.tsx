import React, { createContext, useContext, useEffect, useState } from 'react';
import { ClerkProvider, useAuth } from '@clerk/react';
import { dark } from '@clerk/themes';
import { setAuthTokenGetter } from '../../lib/api';
import { SignInPage } from './SignInPage';
import { BrandLogo } from '../common/BrandLogo';

interface ClerkAuthProviderProps {
  children: React.ReactNode;
}

interface AuthConfigContextType {
  isAuthEnabled: boolean;
  publishableKey: string | null;
}

export const AuthConfigContext = createContext<AuthConfigContextType>({
  isAuthEnabled: false,
  publishableKey: null,
});

export const useAuthConfig = () => useContext(AuthConfigContext);

const STATIC_CLERK_KEY: string = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setAuthTokenGetter(getToken);
    } else {
      setAuthTokenGetter(null);
    }
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0A1214] text-[#F0FDFA] gap-4 select-none">
        <BrandLogo size={48} variant="tabletell-badge" />
        <div className="flex items-center gap-2 text-xs font-mono text-[#5EEAD4]">
          <span className="w-2 h-2 rounded-full bg-[#2DD4BF] animate-ping" />
          <span>Verifying Analyst Session & Lakehouse Security...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <SignInPage />;
  }

  return <>{children}</>;
};

export const ClerkAuthProvider: React.FC<ClerkAuthProviderProps> = ({ children }) => {
  const [publishableKey, setPublishableKey] = useState<string | null>(STATIC_CLERK_KEY || null);
  const [loading, setLoading] = useState<boolean>(!STATIC_CLERK_KEY);

  useEffect(() => {
    // If static key was already baked in at build time, no need to probe backend
    if (STATIC_CLERK_KEY) {
      setLoading(false);
      return;
    }

    // Dynamic runtime key discovery from backend API (Coolify / Docker single-container support)
    let isMounted = true;
    fetch('/api/auth/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.publishable_key) {
          setPublishableKey(data.publishable_key);
        }
      })
      .catch(() => {
        // Fallback to bypass mode if offline or backend is starting up
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0A1214] text-[#F0FDFA] gap-4 select-none">
        <BrandLogo size={48} variant="tabletell-badge" />
        <div className="flex items-center gap-2 text-xs font-mono text-[#5EEAD4]">
          <span className="w-2 h-2 rounded-full bg-[#2DD4BF] animate-ping" />
          <span>Initializing TableTell Security Engine...</span>
        </div>
      </div>
    );
  }

  // If no Clerk Publishable Key is configured anywhere, bypass and allow local dev
  if (!publishableKey) {
    return (
      <AuthConfigContext.Provider value={{ isAuthEnabled: false, publishableKey: null }}>
        {children}
      </AuthConfigContext.Provider>
    );
  }

  return (
    <AuthConfigContext.Provider value={{ isAuthEnabled: true, publishableKey }}>
      <ClerkProvider
        publishableKey={publishableKey}
        appearance={{
          theme: dark,
          variables: {
            colorPrimary: '#0D9488',
            colorBackground: '#0F1A1C',
            colorForeground: '#F0FDFA',
            colorMutedForeground: '#99F6E4',
            borderRadius: '0.75rem',
          },
        }}
      >
        <AuthGate>{children}</AuthGate>
      </ClerkProvider>
    </AuthConfigContext.Provider>
  );
};
