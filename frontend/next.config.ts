/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // UPDATED: Pointing to Backend 2.0
        destination: 'https://mercosur-backend-2-0.onrender.com/:path*',
      },
    ]
  },
}

module.exports = nextConfig