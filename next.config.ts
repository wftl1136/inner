import type { NextConfig } from 'next';

// INNER_MOCK=1 — локальный стенд с данными в памяти вместо Supabase (dev/mock-supabase.ts)
const mock = process.env.INNER_MOCK === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(mock && { turbopack: { resolveAlias: { '@supabase/supabase-js': './dev/mock-supabase.ts' } } }),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self)' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
        ]
      }
    ];
  }
};

export default nextConfig;
