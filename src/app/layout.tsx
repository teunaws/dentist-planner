
import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
    title: 'Dentist Appointment Planner',
    description: 'Efficient appointment scheduling for dental practices',
};

export const viewport: Viewport = {
    themeColor: '#ffffff',
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="min-h-screen bg-white font-sans text-slate-900 antialiased">
                <Providers>
                    <div id="app-root" className="h-full flex flex-col">
                        {children}
                    </div>
                </Providers>
            </body>
        </html>
    );
}
