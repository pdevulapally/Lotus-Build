# Legal release checklist

Owner/counsel checklist, 2 November 2026. Public pages use actual policy/contract language as requested. Removal of draft labels is a presentation change, not approval to merge, deploy or publish.

## Decisions and records required before release

- [ ] Document SR IT SUPPORT SERVICES LTD authority to operate LotusBuild, controller/processor roles and IP ownership/licensing chain. Verify proposed output-rights assignment against provider terms.
- [ ] Resolve registered-office/trader contact disclosures lawfully after owner-requested removal of the street address. Do not substitute an invented address or assume a Companies House link suffices.
- [ ] Confirm mailbox ownership, active monitoring, privacy/cancellation/complaint handling, deputy and escalation. Use only the configured lotusbuild.support@gmail.com until an alternative is approved.
- [ ] Approve launch territories, B2C/B2B scope, current customer/threshold metrics, languages, representatives, local supplements and any necessary launch controls.
- [ ] Verify deployed backend/source, every enabled model route (including OpenRouter/downstream), provider account regions, training/retention settings, signed processor terms and customer DPA.
- [ ] Document actual international transfers, executed safeguards, required transfer assessments and supplementary measures. Final notice must identify verified safeguards/locations and access route, not only generic criteria.
- [ ] Approve category-specific retention/backup/deletion schedule and legal bases; verify live cleanup, provider deletion and retained financial/request records.
- [ ] Verify preview/sharing defaults, link access/revocation, separate origins, sandbox termination, encryption/IAM, staff access and incident response. Reconcile adjacent marketing claims.
- [ ] Confirm 18+ audience, actual age/account population and family/child API availability. Complete separate safeguarding/DPIA and legal design before any child offering.
- [ ] Review lawful-basis and legitimate-interest assessments, records of processing, security/DPIA requirements and ICO registration/fee position.
- [ ] Approve business liability/insurance and any narrowly scoped indemnity; no blanket consumer waiver or zero-fee cap should be inferred.
- [ ] Verify checkout tax/currency/renewal presentation, portal cancellation timing, failed-payment handling, refunds and unused prepaid service. Review imminent UK subscription-regime commencement/transitions.
- [ ] Add lawful immediate-supply requests/durable confirmations/model withdrawal form where applicable. Do not assume accepting general Terms waives cooling-off rights.
- [ ] Design server-recorded legal version/acceptance across email signup, OAuth and checkout. Distinguish Privacy acknowledgement, cookie consent and agent authority.
- [ ] Staff rights/export/erasure and complaints workflows; UK complaints acknowledgement within 30 days; rights/incident time limits require separate monitoring.
- [ ] Counsel approve final Privacy, Terms and any required country notices. Confirm operational specifics are accurate; wording alone does not cure missing controls.
- [ ] Approve effective/update dates, version 1.1 and customer notices only at release. Existing 18 October / 1 November 2026 dates were preserved rather than automatically advanced. No evidence of customer acceptance of version 1.1 exists.

## Engineering validation

- [x] Local working-tree checks: npm run typecheck, npm run test:contracts with public environment loaded, and npm run build all passed. Re-run CI against the committed revision.
- [ ] Check /privacy and /terms headings, anchor navigation, tables, company identity, version/dates and legal links.
- [ ] Check desktop/mobile layouts, dark/light portals, keyboard focus/return, dialog labels, zoom and screen-reader output.
- [ ] Inspect browser network/storage: no analytics script/event before choice; accept/reject; reopening; same-tab and cross-tab withdrawal; malformed/legacy consent; blocked storage; page/query filtering. SDK can remain loaded after withdrawal; beforeSend guard is intended to block subsequent events. Verify against the actual hosted SDK.
- [ ] Verify cookies, SDK session/referrer/device metadata, provider retention and storage lifetimes; assess requested-theme/storage exemptions per country. Legacy lotus_ref values are not automatically deleted by this patch.
- [ ] Exercise authenticated signup/OAuth/checkout/cancellation/erasure with authorised test accounts and provider test modes. No such live verification occurred in this review.
- [ ] Preserve restored docs/voice and all unrelated work. Review branch diff and CI; submit a review PR, never merge/deploy automatically.

## Current evidence limits

All 120 contract tests passed, including six new focused tests for consent parsing, URL filtering, withdrawal/persistence failure, cross-tab change, actual legal rendering and statutory boundaries. Typecheck and production build passed. An earlier child-process invocation without inherited public environment produced three failures; the corrected npm run with configured NEXT_PUBLIC variables passed all 120. No environment file was changed. Browser/desktop host is disconnected, so visual, focus and network verification cannot be certified. Backend/provider production, legal agreements, operations and counsel approval remain unverified.
