import 'server-only'

import { draftMode, headers } from 'next/headers'
import { cache } from 'react'

import { isStaffUser } from '@/access/roles'
import { isLocale } from '@/i18n/locales'
import type { User } from '@/payload-types'

import { getPayloadClient } from './content-client'
import { previewProductHeader, previewViewHeader } from './preview-navigation'

/**
 * Staff draft preview. Draft mode alone is not enough: the request must also carry a valid
 * Payload admin session for a staff account. Guests always get the public, approved content.
 */
export const getPreviewStaffUser = cache(async (): Promise<User | null> => {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return null
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  return isStaffUser(user) ? (user as User) : null
})

/** Product guest simulation keeps the draft but filters its relations/files in ProductPage.
 * Other destinations use actual published visitor reads; never silently return to staff view. */
export const getPreviewUser = cache(async (): Promise<User | null> => {
  const requestHeaders = await headers()
  if (requestHeaders.get(previewViewHeader) === 'guest' && requestHeaders.get(previewProductHeader) !== '1') return null
  return getPreviewStaffUser()
})

/** Only same-site, locale-prefixed paths may be previewed (no open redirects). */
export function safePreviewPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  const [, first] = value.split('/')
  return first && isLocale(first) ? value : null
}
