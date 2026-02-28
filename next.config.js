const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb'
    }
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Production Office
      { source: '/schedule/:id/call-sheet', destination: '/production/schedule/:id/call-sheet', permanent: true },
      { source: '/schedule/:id', destination: '/production/schedule/:id', permanent: true },
      { source: '/schedule', destination: '/production/schedule', permanent: true },
      { source: '/tasks', destination: '/production/tasks', permanent: true },

      { source: '/notes/:id', destination: '/production/notes/:id', permanent: true },
      { source: '/notes', destination: '/production/notes', permanent: true },
      { source: '/activity', destination: '/settings', permanent: true },
      // Script & Story
      { source: '/script-hub', destination: '/script/hub', permanent: true },
      { source: '/scenes/:id', destination: '/script/scenes/:id', permanent: true },
      { source: '/scenes', destination: '/script/scenes', permanent: true },
      // Talent
      { source: '/cast/:id', destination: '/talent/cast/:id', permanent: true },
      { source: '/cast', destination: '/talent/cast', permanent: true },
      { source: '/crew/:id', destination: '/talent/crew/:id', permanent: true },
      { source: '/crew', destination: '/talent/crew', permanent: true },
      { source: '/contacts', destination: '/talent/contacts', permanent: true },
      // Locations, Gear, Catering (now under production)
      { source: '/locations/:id', destination: '/production/locations/:id', permanent: true },
      { source: '/locations', destination: '/production/locations', permanent: true },
      { source: '/gear', destination: '/production/gear', permanent: true },
      { source: '/catering', destination: '/production/catering', permanent: true },
      { source: '/craft-services', destination: '/production/catering', permanent: true },
      // Accounting
      { source: '/budget', destination: '/accounting/budget', permanent: true },
      { source: '/budget-line-items', destination: '/accounting/expenses', permanent: true },
    ];
  }
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;

