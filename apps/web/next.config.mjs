/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google profile images
      },
    ],
  },
};

export default nextConfig;
