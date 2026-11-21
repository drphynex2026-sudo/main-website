# Preview navigation: preserve the selected view

> Historical first pass at `fc86bf5`. Its header/footer-only scope and 19-test
> results do not describe the final remediation. See
> [the follow-up report](preview-navigation-followup-2026-11-21.md) for the
> content-link, public-locale and iframe acknowledgement fixes and final checks.

Base: `bb0e6ca30143194923bc1ef76f766794bd27c877`.
Branch: `codex/preview-navigation-fix`. Not deployed.

## Confirmed cause

In the KO landing builder, select **Xem như khách**, then click FORMA in the
header. Before this change the destination lost `lp=guest`. The staff session
and draft-mode cookie remained valid, so the destination rendered staff marks
and private image references while the parent still showed the guest toggle.
This was a staff simulation failure, not unauthenticated access to private data.
Fresh ordinary staff-preview navigation passed in both EN and KO.

## Change

- Header, footer and language-switch links retain `lp=guest` or `lp=staff` for
  authenticated draft-preview staff. Language switching also retains the page's
  existing allowed filters. Normal visitor links are unchanged.
- Proxy replaces incoming preview-context headers from the URL, forwarding them
  to server rendering. It clones the request before constructing the context
  request so POST bodies remain available to form/action handlers.
- Product guest simulation keeps the saved draft and existing visitor-relation /
  private-file filtering. Other destinations, including Brand and Contact, use
  published visitor reads in guest mode. The guest mode never grants access:
  product draft reads still require both draft mode and staff authentication.
- The preview banner is absent in guest simulation; returning to staff mode works.
  Block-selection click interception inside the builder remains unchanged.

Scope is shared shell menu/footer/language links. Arbitrary links within page
content or custom rich text are not rewritten by this change. The parent editor
continues editing its original document when the iframe browses another product;
use the builder refresh/role controls to return to that document.

## Checks actually run

- Targeted unit: **19/19**, one worker, heap 2048 MiB. Includes shell-generated
  links, language/filter preservation, guest/staff authentication, forged context
  replacement, and POST body preservation. Proxy unit uses a mocked locale
  middleware; real next-intl routing was exercised by the Local browser checks.
- Typecheck (`--noEmit --incremental false`), lint of changed runtime/tests, and
  `git diff --check`: exit 0.
- Production build (20 November 2026): `next build --webpack`, exit 0,
  **Compiled successfully**, 7/7 static pages, heap 2048 MiB and one worker.
  Build ID: `WhHGagvNSyFHBJxdgmfyd`. Fingerprints of all 177 source/runtime/config
  files were identical before and after the build. Only system variables and
  explicit build settings were passed; no `.env`, live database, storage or email
  credentials. The database URL pointed to an unreachable loopback test endpoint.
  This is compilation validation, not a Production runtime test.
- Browser against the changed source on loopback `127.0.0.1:3059`, using a restored
  Local dump in a newly created disposable container. Before restore and fixture
  writes, verified container/network/mounts/loopback binding and database identity:
  `drphynex_independent_review_test`, dedicated non-superuser role, expected marker
  and server IP. No Production database, storage, SMTP or service credentials.
- Actual guest iframe clicks: all four KO product menus, Brand, Contact, return to
  LUMA/FORMA; EN → VI → KO on FORMA. Destination URLs retained `lp=guest`; no staff
  note or private image URL appeared in the inspected document images. Staff-mode
  LUMA → FORMA retained `lp=staff`, draft content and staff note.
- Unauthenticated HTTP: FORMA KO/EN/VI returned HTML 404. Their RSC responses used
  HTTP 200 with `NEXT_HTTP_ERROR_FALLBACK;404`, without the checked private filename
  or draft product names. The private Media file endpoint returned 403.
- All test-created processes/container/network were removed after capture.
  No real content, approvals, public-release flags, accounts or schema changed.
- `vercel.json` disables automatic deployment of this PR branch specifically,
  while retaining the existing branch rule. No Preview environment is provisioned.

## Evidence and limits

Evidence is outside Git in the session visualization directory ending
`01a1868e-41de-74b0-9ec6-567e8dd9bf68`:

- Before: `preview-nav-clicks-final-20261120.json`,
  `preview-navigation-findings-20261120.md`.
- After: `preview-nav-fixed-clicks-20261120.json`,
  `preview-nav-fixed-staff-20261120.json`,
  `preview-nav-fixed-guest-http-20261120.json`,
  `preview-nav-fixed-guest-20261120.jpg`, `preview-nav-dev-20261120.log`.
- Build: `preview-nav-build-20261120.log`, `preview-nav-build-result-20261120.json`,
  `preview-nav-build-source-before-20261120.sha256` and
  `preview-nav-build-source-after-20261120.sha256`.

The Local copy did not include original binary uploads. Staff preview therefore
logged missing-file responses; this run proves filtering / URL behavior, not
successful loading of original packshots. Cold development compilation caused
initial browser wait timeouts for Brand/Contact/Admin; completed requests and
rendered destination content were checked afterward. The 19/19 regression and
browser results above preceded the build; application source did not change
between those checks and the build (only this report and the branch-specific
deployment rule were added/updated). No claim of a Production runtime retest is
made. The owner authorized commit, push and a PR after this successful build;
merge and deployment remain unapproved.
