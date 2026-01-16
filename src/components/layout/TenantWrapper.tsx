'use client';

import { useParams, usePathname } from 'next/navigation';
import { TenantProvider } from '../../context/TenantContext';
import { TopNav } from '../layout/TopNav';

export default function TenantWrapper({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const slug = params?.dentist_slug as string;

    if (!slug) {
        return <>{children}</>;
    }

    // Don't show navigation on specific pages
    const isLoginPage = pathname?.includes('/login');
    const isBookingPage = pathname?.includes('/book');
    const showNav = !isLoginPage && !isBookingPage;

    return (
        <TenantProvider slug={slug}>
            <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
                {showNav && <TopNav />}
                <main className="flex-1 relative overflow-hidden flex flex-col">
                    {children}
                </main>
            </div>
        </TenantProvider>
    );
}
