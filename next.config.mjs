
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    images: {
        domains: ['images.unsplash.com', 'source.unsplash.com'], // External images
    }
};

export default withNextIntl(nextConfig);

