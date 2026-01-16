
'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { HelmetProvider } from 'react-helmet-async';
import * as Sentry from '@sentry/react';
import { useAuthStore } from '../store/authStore';
// Import ErrorPage from legacy_pages. 
// Note: User must rename src/pages to src/legacy_pages for this to work and to avoid Next.js conflict.
// If file not found error occurs, it means folder rename hasn't happened yet.
import { ErrorPage } from '../legacy_pages/ErrorPage';

// Initialize Sentry
if (typeof window !== 'undefined' && !(window as any).SentryInitialized && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
            }),
        ],
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        replaysOnErrorSampleRate: 1.0,
        environment: process.env.NODE_ENV || 'development',
        enabled: true,
    });
    (window as any).SentryInitialized = true;
}

// Auth Initializer Component
const AuthInitializer = () => {
    const initialize = useAuthStore((state) => state.initialize);
    const initialized = useAuthStore((state) => state.initialized);

    useEffect(() => {
        if (!initialized) {
            void initialize();
        }
    }, [initialize, initialized]);

    return null;
};


import { NextIntlClientProvider } from 'next-intl';
import { TenantProvider } from '../context/TenantContext';

export function Providers({ children }: { children: React.ReactNode }) {
    // Create QueryClient ensuring it's stable across renders
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000,
                        retry: 1,
                    },
                },
            })
    );

    return (
        <HelmetProvider>
            <Sentry.ErrorBoundary fallback={<ErrorPage />} showDialog>
                <NextIntlClientProvider locale="en" messages={{}}>
                    <QueryClientProvider client={queryClient}>
                        <AuthInitializer />
                        <TenantProvider slug="">
                            {children}
                        </TenantProvider>
                        <ReactQueryDevtools initialIsOpen={false} />
                    </QueryClientProvider>
                </NextIntlClientProvider>
            </Sentry.ErrorBoundary>
        </HelmetProvider>
    );
}
