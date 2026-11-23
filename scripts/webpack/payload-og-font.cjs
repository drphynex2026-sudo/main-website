// Pinned Payload 3.92.1 contract: no vendor file is edited on disk.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Webpack's CommonJS loader contract.
const path = require('node:path')
module.exports = function payloadOGFontLoader(source) {
  const expected = "import fs from 'fs/promises';"
  if (source.split(expected).length !== 2) {
    throw Error('Payload OG fs import changed; review the font adapter before upgrading')
  }
  const adapter = path.resolve(__dirname, '../../src/lib/payload-og-font.ts')
  return source.replace(
    expected,
    `import fs from ${JSON.stringify(adapter.replaceAll('\\', '/'))};`,
  )
}
