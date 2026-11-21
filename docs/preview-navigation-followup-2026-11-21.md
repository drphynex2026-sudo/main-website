# Preview navigation — follow-up, 21 November 2026

Branch: `codex/preview-navigation-fix`; base: `fc86bf594979fada15e83c25ca4dcf7ca0dcae3d`.
PR #2 remains unmerged, with auto-deployment disabled for this branch.

## Reproduction and correction

Independent browser reproduction on the base, in an isolated Local DB copy:
KO original LUMA draft → **Xem như khách** → breadcrumb **제품** → FORMA card.
The breadcrumb dropped `lp`; the product list rendered the staff banner, and the
next product rendered staff marks and three private image references. The parent
Guest button remained pressed. This was a staff preview-simulation bug, not an
anonymous access grant.

The follow-up replaces frontend Next Links and CMS rich-text links with a shared
context-aware Link. This covers breadcrumbs, content cards, filters, pagination,
form privacy/remove-product links, header/footer and language navigation, including
SSR hrefs, prefetch and normal client navigation. Same-origin frontend relative /
absolute links retain context; external links, mail/tel, fragments and exit/API/
Admin paths are not given `lp`. Existing block-selection interception is unchanged.
Most changed page files only replace their Link import.

`lpOrigin` identifies the original product being edited; it is not an authorization
credential. Only that original draft retains staff-authorized guest simulation.
Other products, lists and globals use public published/approved reads in Guest
mode. Draft mode AND staff authentication remain required for the draft exception.
Guest language availability for products uses anonymous counts with access checks,
not the staff shortcut that enables all languages. Guest placeholders are suppressed
even on the original draft; structural staff markers replace string matching.

Every PageShell reports its actual rendered mode and URL, after document loads and
soft navigation. The builder checks origin, frame window, URL and report shape;
navigation clears confirmation. Missing/mismatched reports do not assert Guest.
Both role buttons become unpressed and an explicit warning is shown when the mode
cannot be confirmed. No automatic reload/retry masks a mismatch. Changing mode
keeps the current inner route/language. Changing the outer edited document/locale
resets to that document. The parent continues editing its own document, not the
product visited inside the iframe.

## Final checks actually run

| Check | Result and scope |
| --- | --- |
| Unit | **719/719**, 35 files, verbose log, one worker, heap 2048 MiB. Includes breadcrumb/rich text/form SSR, external/exit exclusions, soft-navigation reports, locale/mode changes, public locale counts and guest placeholders. |
| Lint | Exit 0 for every changed code/test file. |
| Typecheck/build | Final production webpack build exit 0; Compiled successfully; TypeScript passed; 7/7 static pages, one worker, heap 2048 MiB. Build ID **E3PP6kSN7uvPAC23ye-hd**. |
| Build identity | 178 source/runtime/config files had identical byte fingerprints before/after final build. `.env` and live service credentials were not supplied; build used an unreachable loopback DB URL and Local origin. |
| Browser | Real browser on that production output at loopback :3059, DB disposable only. Original KO draft guest → breadcrumb list → public fixture; list exposed only the public fixture. All observed guest pages had zero structural staff markers/private image references. |
| Form / language | Product-interest link → Contact → remove selected product → EN Contact → Staff → Guest retained EN Contact. Form privacy link then reached EN Privacy in Guest mode. |
| Public locales | Original draft remained viewable for editing, but EN/VI not public were disabled. Public fixture had only KO enabled. Lists/Contact keep their normal language options and recheck target content. |
| Other draft / unknown | Guest navigation to another unpublished product rendered not-found. Staff could still read that draft. Exit-preview href carried no context; after exit, neither outer role button was pressed and the unknown-mode warning appeared. |
| Anonymous HTTP | **14/14** assertions: KO/EN/VI draft HTML 404; RSC used HTTP 200 with not-found marker; API draft requests 404; private Media metadata 404/file 403; KO public fixture 200 and EN/VI 404. Forged preview headers did not grant access. |
| Data / cleanup | Only neutral fixture account/product were created in a verified copy of Local data. No Production writes, publishing, migrations, ACL/account changes or upload tests. The test app and both test-created containers/networks were removed by verified PID/ID. |

No schema, access hooks, migrations, manifests, dependencies or deployment settings
changed in this follow-up. Generated Payload types/import-map content matched HEAD;
only their generated LF/checkout CRLF difference was restored after testing.

## Failure classification and evidence limits

The two historical failure attempts visible in the earlier tool transcript were:

1. `preview-proxy.spec.ts`: **suite import failure before any test ran**, because
   Vitest external ESM resolution of next-intl could not resolve `next/server`.
   The unit now explicitly mocks locale middleware; browser checks cover the real
   middleware. This was not evidence of an intermittent application failure.
2. `preview-proxy.spec.ts > does not consume or replace the body of a form/action
   request`: `TypeError: Body is unusable: Body has already been read`. This exposed
   a real request-cloning issue; `request.clone()` fixed it before `fc86bf5`.

Those original terminal outputs are in the chat, not preserved complete raw files
on disk. They are not relabeled as two flaky tests. Current complete per-test logs
are retained. Baseline 19/19, intermediate 44/44, full 713/713, 717/717 and 718/718
are historical stages; **719/719 is the final source**, not a sum of those runs.

During this follow-up, a typecheck run concurrent with dev regeneration reported
six missing `.next/dev/types` files; the stable typecheck and final build passed.
The first lint run found `react/no-children-prop` in the new SSR test; it was fixed.
Dev later restarted near its memory threshold and logging/cache writes hit ENOSPC.
The dev log file became empty; its terminal error and browser before-results remain
in the tool transcript. Only worktree Next caches were removed after process checks.
The final checks used stable production output, with no heap/system increase.

An earlier intermediate build printed “Compiled with warnings” without diagnostic
details. That log is retained and is a limit; the final build printed Compiled
successfully, which does not prove every historical warning was fixed.

The Local copy had no original binary uploads. Staff missing-file responses are
expected in this fixture setup; this is not a packshot delivery or R2 upload retest.
Browser JSON export initially wrote an empty steps array due to the harness's array
binding. That empty artifact is retained separately. The final browser summary is
explicitly transcribed from the observed CUA DOM/control outputs, with screenshots;
it is not presented as a raw HAR or raw automated browser trace. No new run is
claimed for this evidence transcription.

## Evidence (outside Git)

Session evidence directory suffix: `01a1868e-41de-74b0-9ec6-567e8dd9bf68`.

- Baseline: `preview-nav-r2-browser-before.json`, `preview-nav-r2-baseline-unit.log`.
- Final unit/lint: `preview-nav-checkpoint-unit-20261121.log`,
  `preview-nav-checkpoint-lint-20261121.log`.
- Final build: `preview-nav-checkpoint-build-20261121.log`, corresponding result
  JSON and source-before/source-after `.sha256` files.
- Browser: `preview-nav-checkpoint-browser-20261121.json`,
  `preview-nav-checkpoint-guest-20261121.jpg`, `preview-nav-checkpoint-unknown-20261121.jpg`.
- HTTP: `preview-nav-checkpoint-http-20261121.mjs` and `.json`.

No dump, credential, private asset or runtime secret is included in the PR.
This is readiness for independent code review, not approval to merge/deploy.
