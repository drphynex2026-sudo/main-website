// Pinned SDK import adapter for measurement only; does not alter vendor files.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Webpack's CommonJS loader contract.
const path = require('node:path')
module.exports = function payloadInitTimingLoader(source) {
  const expected = 'getAccessResults, getPayload, getRequestLanguage'
  if (source.split(expected).length !== 2)
    throw Error('Payload init import changed; review timing adapter')
  const adapter = path
    .resolve(__dirname, '../../src/lib/admin-server-timing.ts')
    .replaceAll('\\', '/')
  return (
    `import { tracePayloadInitialization, registerPayloadInitAdapter } from ${JSON.stringify(adapter)};\nregisterPayloadInitAdapter();\n` +
    source.replace(
      expected,
      'getAccessResults, getPayload as getPayloadOriginal, getRequestLanguage',
    ) +
    '\nfunction getPayload(...args) { return tracePayloadInitialization(() => getPayloadOriginal(...args)); }\n'
  )
}
