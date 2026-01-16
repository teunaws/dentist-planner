import { NextRequest, NextResponse } from 'next/server';

// 1. Mock DB Config
const MOCK_DB: Record<string, { supported: string[], default: string }> = {
    'smile-clinic': { supported: ['en', 'nl'], default: 'nl' },
    'dr-smith': { supported: ['fr'], default: 'fr' },
    'lumina': { supported: ['en', 'es'], default: 'en' },
    // Admin is NOT a tenant in the traditional sense for routing, but kept if needed for logic data
};

const DEFAULT_GLOBAL_LOCALE = 'en';
const SUPPORTED_GLOBAL_LOCALES = ['en', 'nl', 'fr', 'es', 'de'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Exclude static assets and API routes
    if (
        pathname.match(/\/(api|_next|static|favicon\.ico|.*\..*)/) ||
        pathname === '/manifest.json' || pathname === '/robots.txt'
    ) {
        return NextResponse.next();
    }

    // 2. EXPLICITLY ALLOW ADMIN ROUTES (Non-localized)
    if (pathname.startsWith('/admin')) {
        return NextResponse.next();
    }

    const segments = pathname.split('/').filter(Boolean);

    // Root path -> redirect to default global locale
    if (segments.length === 0) {
        const newUrl = new URL(`/${DEFAULT_GLOBAL_LOCALE}`, request.url);
        return NextResponse.redirect(newUrl);
    }

    const firstSegment = segments[0];
    const secondSegment = segments[1];

    // Check if first segment is a known locale
    const isFirstSegmentLocale = SUPPORTED_GLOBAL_LOCALES.includes(firstSegment);

    if (isFirstSegmentLocale) {
        // URL structure: /[locale]/[dentist_slug]... OR /[locale] (Home)
        const locale = firstSegment;
        const slug = secondSegment;

        // If checking a specific tenant (slug exists)
        if (slug && MOCK_DB[slug]) {
            const tenantConfig = MOCK_DB[slug];

            // Check if this locale is supported by the tenant
            if (!tenantConfig.supported.includes(locale)) {
                // Redirect to tenant's default locale, preserving path
                // Correction: pathname is /en/smile-clinic/book -> /smile-clinic/book... 
                // We want to replace /en with /nl

                // Construct new URL: /[default_locale]/[slug]/[rest]
                // Be careful with substrings. 
                // Easiest: regex replace first segment
                const newPath = pathname.replace(`/${locale}`, `/${tenantConfig.default}`);
                const newUrl = new URL(newPath, request.url);
                return NextResponse.redirect(newUrl);
            }
        }

        return NextResponse.next();

    } else {
        // URL structure: /[dentist_slug]... or just random path (Missing locale)
        const slug = firstSegment;

        if (MOCK_DB[slug]) {
            const tenantConfig = MOCK_DB[slug];

            // Detect browser language
            const acceptLanguage = request.headers.get('accept-language');
            let targetLocale = tenantConfig.default;

            if (acceptLanguage) {
                const preferredLocales = acceptLanguage.split(',').map(l => l.split(';')[0].split('-')[0]);
                const match = preferredLocales.find(l => tenantConfig.supported.includes(l));
                if (match) {
                    targetLocale = match;
                }
            }

            // Redirect to /[targetLocale]/[slug]...
            const newUrl = new URL(`/${targetLocale}${pathname}`, request.url);
            return NextResponse.redirect(newUrl);
        }

        // Redirect generic paths to default global locale
        // e.g. /about -> /en/about
        const newUrl = new URL(`/${DEFAULT_GLOBAL_LOCALE}${pathname}`, request.url);
        return NextResponse.redirect(newUrl);
    }
}

export const config = {
    matcher: [
        // Match all paths except those starting with:
        // - api (API routes)
        // - _next/static (static files)
        // - _next/image (image optimization files)
        // - favicon.ico (favicon file)
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
