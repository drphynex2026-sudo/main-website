import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * Baseline headers for every route, including the Payload admin. A full script CSP is not set:
 * Next.js inline bootstrap scripts and the Payload admin need nonce support first (see
 * docs/tracking-and-seo.md). frame-ancestors alone is safe and blocks clickjacking.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
]

const nextConfig: NextConfig = {
  // Also stops @payloadcms/next/withPayload from adding "X-Powered-By: Next.js, Payload".
  poweredByHeader: false,
  headers: async () => [{ source: '/:path*', headers: securityHeaders }],
  images: {
    // Media release can be revoked; serve originals through Payload on every request.
    unoptimized: true,
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig, { isServer, webpack }) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    if (isServer) {
      // Payload 3.92.1's OG module derives its font path from import.meta.url.
      // Webpack freezes that URL to the build machine. Inline this one public
      // vendor asset and replace ONLY that module's fs import, not other IO.
      webpackConfig.module ??= {}
      webpackConfig.module.rules ??= []
      webpackConfig.plugins ??= []
      webpackConfig.plugins.push(
        new webpack.DefinePlugin({
          __PAYLOAD_OG_FONT_BASE64__: JSON.stringify(
            readFileSync(
              path.join(
                dirname,
                'node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff',
              ),
            ).toString('base64'),
          ),
        }),
      )
      // Built-in fs is externalized before NormalModuleReplacementPlugin can
      // rewrite it. Transform this one SDK source before dependency parsing.
      webpackConfig.module.rules.push({
        test: /[\\/]@payloadcms[\\/]next[\\/]dist[\\/]routes[\\/]rest[\\/]og[\\/]index\.js$/,
        enforce: 'pre',
        use: [{ loader: path.join(dirname, 'scripts/webpack/payload-og-font.cjs') }],
      })
      webpackConfig.module.rules.push({
        test: /[\\/]@payloadcms[\\/]next[\\/]dist[\\/]utilities[\\/]initReq\.js$/,
        enforce: 'pre',
        use: [{ loader: path.join(dirname, 'scripts/webpack/payload-init-timing.cjs') }],
      })
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
