# Verification

Status: public and private evidence categories and initial owner review confirmed; detailed verification interview remains required. No verification API, status model, retention policy or confidence formula approved.

## Confirmed direction - 2026-09-15

The user selected public sources plus private documents reviewed by them. They also selected walking through a real example before settling details. This refers to the current question's third option; it is not approval to implement an automated source integration.

Decided 2026-09-18 and implemented: the owner's ruling explanation is public; objections are visible only to their author and the owner. The outcome forms record a public explanation and whether the owner reviewed proof or received none. They do not collect original documents. This narrow ruling/objection decision does not settle evidence access, uploads, retention, redaction or AI processing.

The selected technical foundation can support restricted Supabase Storage, but that infrastructure choice does not decide evidence visibility, retention, redaction or what establishes a claim. Goal examples will be used to specify acceptable proof. A public announcement may still be self-reported and a private screenshot may be insufficient; accepting an evidence category does not automatically verify its contents.

## Purpose

Information can change beliefs and prices. Users should be able to distinguish a subject's assertion from reviewed evidence and identify what supports it. Source: PDF sections 7-9, pages 6-8.

The brief considers public APIs, OAuth connections, private documents, URLs, admin review, third-party confirmation, disputes and time-based rechecks. These are options. Manual review is an explicit candidate for the MVP; full automation is not required by the source.

## Distinctions the implementation must preserve

- Identity or account control does not by itself establish a particular factual claim.
- An authentic source/document does not necessarily establish the claimed interpretation.
- A verified factual update does not automatically resolve a market; its specific rules still apply.
- A source observation has both an event/measurement time and a collection/review time.
- A current claim status does not erase earlier statuses or corrections, subject to the agreed privacy/retention rules.

## Provenance required by the brief

Meaningful claims should be able to carry text/structured values, subject, timestamps, verification status, source/evidence reference, verifier, confidence, last check, expiry/recheck policy, correction/revocation history, and the actor/reason behind changes.

The proposed SELF_REPORTED, EVIDENCE_SUBMITTED, VERIFICATION_PENDING, MACHINE_VERIFIED, ADMIN_VERIFIED, SOURCE_VERIFIED, DISPUTED, REJECTED and REVOKED labels mix workflow, method and validity. Do not implement them as a single final enum without the interview. A confidence field is not permission to fabricate a numeric probability of truth.

## Pending interview

1. Which claim types and sources are necessary for the first cohort?
2. What does each source establish, and what wins when sources conflict?
3. Are private documents necessary, and who can see originals, redactions, or only a public summary?
4. What are retention, deletion, expiry and recheck policies?
5. Who can approve, reject, dispute, revoke or restore a claim? How are conflicts of interest handled?
6. What public explanations and appeal procedures accompany each decision?
7. Is AI inspection useful as reviewer assistance, and what is it never allowed to conclude alone?

Do not upload user evidence to an external AI/provider without an agreed workflow and privacy boundary.

## Acceptance criteria after decisions

- Evidence access is authorized at the storage and application layers.
- Restricted material is absent from public APIs, rendered pages, analytics payloads and logs.
- Review decisions retain actor, time, reason and source/version references.
- Corrections/revocations can be traced without silently rewriting what users previously saw.
- Revoked or stale information is displayed/ranked according to the approved policy.
- Negative but truthful disclosures receive the same factual review standard as favorable ones.
