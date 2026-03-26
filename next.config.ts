import type { NextConfig } from 'next'
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Carrega .env.vercel.local no dev (Vercel CLI não lê este arquivo automaticamente)
if (process.env.NODE_ENV !== 'production') {
  const vercelEnvPath = resolve(process.cwd(), '.env.vercel.local')
  if (existsSync(vercelEnvPath)) {
    loadEnv({ path: vercelEnvPath })
  }
}

const isProd = process.env.NODE_ENV === 'production'

// Content Security Policy para prevenir XSS.
// Permite scripts do próprio domínio + inline necessário para Next.js (nonce ideal mas complexo).
// Para uso bancário: fortaleça removendo 'unsafe-inline' e usando nonce por requisição.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval necessário para Next.js dev; remover em prod se possível
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://graph.facebook.com https://api.openai.com https://generativelanguage.googleapis.com",
  "frame-ancestors 'none'", // Proteção extra contra clickjacking (mais forte que X-Frame-Options)
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

// Security hardening: headers que reduzem a superfície de ataque.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'Content-Security-Policy', value: cspDirectives },
  // HSTS em todos os ambientes de produção e staging
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
    : []),
] satisfies Array<{ key: string; value: string }>

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default
  reactStrictMode: true,

  // Hide framework fingerprinting header
  poweredByHeader: false,

  // Standalone output for Docker
  output: 'standalone',

  // Optimize barrel imports for better tree-shaking (experimental in Next.js 16)
  // This automatically transforms imports like `import { X } from 'lucide-react'`
  // to direct module imports, reducing bundle size significantly
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Aumentar limite de body para uploads de mídia (vídeos até 16MB)
    serverActions: {
      bodySizeLimit: '20mb',
    },
    // Aumentar limite para proxy e middleware (necessário para uploads grandes)
    proxyClientMaxBodySize: '20mb',
  },

  // Include SQL migration files in the serverless bundle
  outputFileTracingIncludes: {
    '/api/installer/run-stream': ['./supabase/migrations/**/*'],
  },

  // Environment variables exposed to client
  env: {
    NEXT_PUBLIC_APP_NAME: 'SmartZap',
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || '1.0.0',
  },

  // React Compiler for automatic memoization (moved from experimental in Next.js 16)
  reactCompiler: true,

  // Turbopack config
  turbopack: {
    // Set the workspace root to this directory
    root: __dirname,
  },

  async redirects() {
    return [
      // Redireciona rotas de documentação legada para a rota real do wizard
      {
        source: '/install/start',
        destination: '/install',
        permanent: false,
      },
      {
        source: '/install/wizard',
        destination: '/install',
        permanent: false,
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
}

export default nextConfig
