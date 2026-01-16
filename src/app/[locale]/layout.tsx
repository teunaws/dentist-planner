
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';




export default async function LocaleLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params; // Next.js 15+ await params

    // Ensure that the incoming `locale` is valid
    // const {locale} = await params;
    // if (!routing.locales.includes(locale as any)) {
    //   notFound();
    // }

    // Providing all messages to the client
    // side is the easiest way to get started
    const messages = await getMessages();

    return (
        <NextIntlClientProvider messages={messages} locale={locale}>
            {children}
        </NextIntlClientProvider>
    );
}
