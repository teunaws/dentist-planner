import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title: string
  description?: string
  image?: string // OG Image
  type?: string
  keywords?: string
}

export const SEO = ({ title, description, image, type = 'website', keywords }: SEOProps) => {
  const siteTitle = `${title} | Dentist Planner` // Suffix

  return (
    <Helmet>
      {/* Standard Meta Tags */}
      <title>{siteTitle}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
    </Helmet>
  )
}

