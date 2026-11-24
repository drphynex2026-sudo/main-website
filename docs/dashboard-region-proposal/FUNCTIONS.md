# Inventory deployment trước thử region

Nguồn: Vercel inspect/API, ngày 23/11/2026. SHA `e3e4eb04b8ce5432bad1945bb28cd365da5502d3`, deployment `dpl_Vm1jvrB5kisYZ9hfSn6KboZg5ARY`.

52 output entries: 51 ứng dụng và 1 Routing Middleware; không khẳng định là52 process hoặc 52 Lambda functionName độc lập. Các entry RSC/segment có thể cùng function artifact. Tất cả hiện Node 24, 2048 MiB, 300s; không đề xuất thay các giá trị này.

|Output entry|Region hiện tại|Dự kiến sau patch (phải xác minh thực)|
|---|---|---|
|`[locale]`|iad1|sin1|
|`[locale].rsc`|iad1|sin1|
|`[locale]/[...rest]`|iad1|sin1|
|`[locale]/[...rest].rsc`|iad1|sin1|
|`[locale]/[legal]`|iad1|sin1|
|`[locale]/[legal].rsc`|iad1|sin1|
|`[locale]/brand`|iad1|sin1|
|`[locale]/brand.rsc`|iad1|sin1|
|`[locale]/contact`|iad1|sin1|
|`[locale]/contact.rsc`|iad1|sin1|
|`[locale]/ingredients`|iad1|sin1|
|`[locale]/ingredients.rsc`|iad1|sin1|
|`[locale]/ingredients/[slug]`|iad1|sin1|
|`[locale]/ingredients/[slug].rsc`|iad1|sin1|
|`[locale]/journal`|iad1|sin1|
|`[locale]/journal.rsc`|iad1|sin1|
|`[locale]/journal/[slug]`|iad1|sin1|
|`[locale]/journal/[slug].rsc`|iad1|sin1|
|`[locale]/partnership`|iad1|sin1|
|`[locale]/partnership.rsc`|iad1|sin1|
|`[locale]/products`|iad1|sin1|
|`[locale]/products.rsc`|iad1|sin1|
|`[locale]/products/[slug]`|iad1|sin1|
|`[locale]/products/[slug].rsc`|iad1|sin1|
|`[locale]/products/line/[slug]`|iad1|sin1|
|`[locale]/products/line/[slug].rsc`|iad1|sin1|
|`[locale]/stores`|iad1|sin1|
|`[locale]/stores.rsc`|iad1|sin1|
|`[locale]/technologies/[slug]`|iad1|sin1|
|`[locale]/technologies/[slug].rsc`|iad1|sin1|
|`_not-found`|iad1|sin1|
|`_not-found.rsc`|iad1|sin1|
|`admin/[[...segments]]`|iad1|sin1|
|`admin/[[...segments]].rsc`|iad1|sin1|
|`_global-error`|iad1|sin1|
|`_global-error.rsc`|iad1|sin1|
|`_global-error.segments/_full.segment.rsc`|iad1|sin1|
|`_global-error.segments/_global-error/__PAGE__.segment.rsc`|iad1|sin1|
|`_global-error.segments/_tree.segment.rsc`|iad1|sin1|
|`_middleware`|bom1, fra1, gru1, iad1, lhr1, sfo1, sin1, syd1|Vercel quản lý phân phối, không ép một region|
|`api/[...slug]`|iad1|sin1|
|`api/[...slug].rsc`|iad1|sin1|
|`api/graphql`|iad1|sin1|
|`api/graphql-playground`|iad1|sin1|
|`api/graphql-playground.rsc`|iad1|sin1|
|`api/graphql.rsc`|iad1|sin1|
|`preview`|iad1|sin1|
|`preview.rsc`|iad1|sin1|
|`preview/exit`|iad1|sin1|
|`preview/exit.rsc`|iad1|sin1|
|`sitemap.xml`|iad1|sin1|
|`sitemap.xml.rsc`|iad1|sin1|
