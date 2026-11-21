# Journal redirects and same-URL preview acknowledgement

Base: `c75dfe978548a99b2f61cce27ad3a8e980371d64`.
Branch: `codex/preview-navigation-fix`, PR #2. Not merged/deployed.

## Confirmed before changing application code

Production Local baseline build `E3PP6kSN7uvPAC23ye-hd`, with a new verified
disposable copy of Local data, neutral public KO-only topic/product and a draft
article titled `CODEX PRIVATE JOURNAL DRAFT`:

- Guest → Journal page 999 redirected to `/ko/journal`, dropping preview context.
  The destination showed the staff marker and draft sentinel; neither role button
  was confirmed. KO topic → EN (where the topic was not public) likewise dropped
  context during normalization.
- Clicking the selected topic tab or the logo at the exact current homepage URL
  cleared confirmation and left it stuck. No route/search change meant no new
  rendering acknowledgement arrived.
- The first `#main` click already scrolled correctly and retained Guest. It was
  not classified as an application failure. No native anchor cancellation or
  custom scrolling was added.
- Three regression tests against actual page functions failed before the fix:
  Journal page clamp, Journal topic removal, and legacy Ingredient → Technology.
  Each received the right destination path but without `lp`/`lpOrigin`.

Early fixture links were adjacent inline text and one multi-line hit target was
ambiguous. They were separated into paragraphs in the disposable data. Earlier
attempt records are retained and annotated, not used to claim a valid public KO
topic was itself broken. A premature click that remained on the fixture was also
not counted as a successful reproduction; the confirmed destination was checked.

## Minimal changes

1. Journal normalization and the legacy Technology redirect use the existing
   `previewHref` through `previewRedirectHref`. Only scalar `guest`/`staff` and a
   lowercase slug of 1–80 characters are retained. Invalid/array context and other
   incoming query fields are not copied. Public redirects without preview context
   keep their existing behavior.
2. The reporter invalidates confirmation only for a real pathname/search change.
   Same-URL logo/filter clicks and hash-only links do not wait for a new page.
   Native Link behavior remains responsible for scrolling; hash events report
   the actual current URL, and hash-only history events re-acknowledge directly.
3. The parent still verifies the frame window, origin, report and rendered mode.
   URL matching accepts only the known Journal clamp/topic-removal normalization
   and exact legacy Technology alias while retaining preview identity. Other
   routes/modes/origins remain rejected. Acknowledged pending URLs are cleared so
   a later hash report does not get rejected against an obsolete URL.

This URL matching is an iframe status check, not a content authorization rule.
No CMS access, approval, migration, dependency, upload or layout changes were made.
The preview-entry authentication redirect and exit-preview route were reviewed;
they intentionally keep their login/exit behavior and were not decorated. The
frontend redirect search found no other application content redirects beyond
Journal and the legacy Technology alias. Locale middleware remains unchanged.

## Results on the fixed source

| Check | Actual result |
| --- | --- |
| Targeted regression | **44/44**, seven files, one worker, heap 2048 MiB; includes the three formerly failing page functions, invalid query context, canonical acknowledgement, same-URL/anchor behavior and existing guest/locale checks. |
| Lint | Exit 0, no final warnings. A rule warning on changing an in-memory test location was explicitly documented at that test line; no production suppression. |
| Production build | **Exit 0**, Compiled successfully; TypeScript passed, 7/7 static pages, one worker/2048 MiB. Build ID **FVUkS718Gm9iVHAvudXpN**. All 178 source/runtime/config byte hashes matched before/after build. |
| Browser on that output | Invalid page and invalid topic → canonical Journal retained Guest/context. KO public topic → EN topic removal → VI retained Guest. No staff markers or draft sentinel in any of 11 after records. |
| Same URL | Selected All/topic tabs and repeat homepage logo retained Guest, with no stuck unknown-mode warning. |
| Anchor | First click reached `#main`, target top 4 px, matching the pre-fix observation. Repeated anchor retained Guest; this is not a claim that repeated same-hash scrolling differs from Next's existing behavior. |
| Anonymous HTTP | **7/7 cases**: canonical redirect locations retain only valid context; valid public KO topic is 200; followed pages contain no private article; anonymous API query with `draft=true` returns zero matching draft documents. |
| Cleanup | Only the test-created app/container/network removed by verified PID/ID; no Production writes or service changes. |

The previous 719/719 full unit result belongs to `c75dfe9`; it was not rerun or
relabelled as a full-suite result for this smaller change. No upload or broad Admin
acceptance was repeated. The Technology alias was checked by source and actual page
function regression, not a separate browser fixture for Technology.

Evidence stays outside Git in session directory suffix
`01a1868e-41de-74b0-9ec6-567e8dd9bf68`:

- `preview-journal-red-20261121.log`: three expected pre-fix failures.
- `preview-journal-unit-final-20261121.log`: full names/results of 44 regressions.
- `preview-journal-lint-final-20261121.log`.
- `preview-journal-build-20261121.log`, build-result JSON and source SHA-256 files.
- `preview-journal-browser-20261121.json`: actual incremental DOM/control export,
  12 baseline attempt/observation records and 11 after records, with fixture notes.
- `preview-journal-fixed-20261121.jpg`, `preview-journal-http-20261121.json`.

No credential, dump or private asset is committed. Ready for review of this update;
no permission to merge/deploy is inferred.
