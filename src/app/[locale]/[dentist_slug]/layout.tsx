import { redirect } from 'next/navigation';
import TenantWrapper from '../../../components/layout/TenantWrapper';

export default async function TenantLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string; dentist_slug: string }>;
}) {
    const { locale, dentist_slug } = await params;

    // 1. Check if dentist exists using direct fetch to Supabase REST API
    // This avoids needing a full Server Client instantiation for a simple check
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let isValid = false;

    if (supabaseUrl && supabaseKey) {
        try {
            const response = await fetch(
                `${supabaseUrl}/rest/v1/tenants?slug=eq.${dentist_slug}&deleted_at=is.null&select=id`,
                {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    cache: 'no-store' // Always fetch fresh to avoid caching invalid states
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    isValid = true;
                }
            }
        } catch (error) {
            console.error('Error checking tenant existence:', error);
            isValid = false;
        }
    } else {
        // Fail closed if env vars missing
        console.warn('Supabase env vars missing in TenantLayout check');
        isValid = false;
    }

    if (!isValid) {
        // 2. Redirect to Home if invalid
        redirect(`/${locale}`);
    }

    // 3. Render the Client Wrapper
    return (
        <TenantWrapper>
            {children}
        </TenantWrapper>
    );
}
