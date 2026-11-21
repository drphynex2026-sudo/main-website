import { permanentRedirect } from 'next/navigation'
import { detailMetadata, IngredientDetail } from '@/components/ingredient/DetailPage'
import { findPublicBySlug } from '@/lib/content'
import { pageLocale, type SlugParams, type SearchParams } from '@/lib/locale'
import { previewRedirectHref } from '@/lib/preview-navigation'
export async function generateMetadata({ params }: { params: SlugParams }) { return detailMetadata('ingredients', params) }
export default async function Page({ params, searchParams }: { params: SlugParams; searchParams: SearchParams }) {
 const locale = await pageLocale(params)
 const { slug } = await params
 if (!(await findPublicBySlug('ingredients', slug, locale)) && await findPublicBySlug('technologies', slug, locale)) {
  permanentRedirect(previewRedirectHref('/' + locale + '/technologies/' + slug, await searchParams))
 }
 return <IngredientDetail kind="ingredients" params={params} />
}
