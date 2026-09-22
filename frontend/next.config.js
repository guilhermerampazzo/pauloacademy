/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false, // v2: não expõe "X-Powered-By: Next.js"
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  // v2.2: a categoria "Superior" virou "Superior Sequencial"
  async redirects() {
    return [{ source: '/superior', destination: '/superior-sequencial', permanent: true }]
  },
  async rewrites() {
    const internalApi = process.env.INTERNAL_API_URL || 'http://backend:3001'
    const minioEndpoint = process.env.MINIO_INTERNAL_URL || 'http://minio:9000'
    const minioBucket = process.env.MINIO_BUCKET || 'academy-uploads'
    return [
      {
        source: '/api/:path*',
        destination: `${internalApi}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${minioEndpoint}/${minioBucket}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
