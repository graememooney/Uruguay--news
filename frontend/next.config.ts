/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // We are forcing it to use your Live Render Backend
        destination: 'https://mercosur-backend.onrender.com/:path*',
      },
    ]
  },
}

module.exports = nextConfig