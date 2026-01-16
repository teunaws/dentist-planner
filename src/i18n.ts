import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

// Can be imported from a shared config
const locales = ['en', 'nl', 'fr', 'de', 'es'];

export default getRequestConfig(async ({ requestLocale }) => {
    // Validate that the incoming `locale` parameter is valid
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let locale = await requestLocale;

    if (!locale || !locales.includes(locale as any)) {
        // fallback or notFound()
        // usually middleware handles redirection, but for robust typing:
        // notFound();
        // For now, if unknown, default to en to prevent crash if middleware missed it
        locale = 'en';
    }

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default
    };
});
