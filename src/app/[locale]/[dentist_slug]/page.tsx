import { redirect } from 'next/navigation';

// 1. Make the component async
export default async function DentistEntry({
    params
}: {
    params: Promise<{ locale: string; dentist_slug: string }> // 2. Type params as a Promise
}) {
    // 3. Await the params before using them
    const { locale, dentist_slug } = await params;

    // 4. Now redirect with the resolved values
    redirect(`/${locale}/${dentist_slug}/book`);
}