# Verification email

In the existing Supabase project, open **Authentication → Emails**.
For both **Confirm signup** and **Magic link or OTP**:

1. Set the subject to `Your Mitra verification code`.
2. Replace the entire Body source with `verification.html` from this folder.
3. Preview, then save changes.

These are hosted Auth settings: pushing this file does not automatically publish
the email template. SMTP credentials and provider settings stay unchanged.

The app passes its validated `osu` / `uiuc` selection in signup metadata. The
template uses `.Data.campus` only for presentation, never access control. Existing
owner mailboxes without campus metadata use the Ohio State variant; unknown
campus values get neutral Mitra branding. Existing users without metadata may
also receive the neutral variant. Do not put passwords or tokens in this file.

Keep `{{ .Token }}` intact. The code length is controlled by Supabase Auth
settings, not by the template. Real inbox delivery and campus-specific rendering
should be checked before inviting new members.
