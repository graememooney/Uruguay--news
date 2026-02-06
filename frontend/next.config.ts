/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // When running locally, go to localhost. 
        // When on Vercel, we will use an Environment Variable.
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/:path*` 
          : 'http://127.0.0.1:8003/:path*', 
      },
    ]
  },
}

module.exports = nextConfig