declare const __PAYLOAD_OG_FONT_BASE64__: string
const bytes = Buffer.from(__PAYLOAD_OG_FONT_BASE64__, 'base64')

/** Build-time replacement for ONLY Payload 3.92.1's OG fs/promises import.
 * No disk lookup, network, Payload data or user cache. Return a fresh buffer,
 * like fs.readFile, so one renderer cannot mutate another request's font.
 */
const payloadOGFont = {
  async readFile(file: unknown): Promise<Buffer> {
    if (typeof file !== 'string' || file.split(/[\\/]/).at(-1) !== 'roboto-regular.woff') {
      throw new Error('Unsupported Payload OG asset')
    }
    return Buffer.from(bytes)
  },
}

export default payloadOGFont
