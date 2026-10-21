# Verification email

In the existing Supabase project, open **Authentication → Emails**.
For both **Confirm signup** and **Magic link or OTP**:

1. Set the subject to `Your Mitra verification code`.
2. Replace the entire Body source with `verification.html` from this folder.
3. Preview, then save changes.

These are hosted Auth settings: pushing this file does not automatically publish
the email template. SMTP credentials and provider settings stay unchanged.

The template uses neutral Mitra branding for every verified email address.
It does not use university domains or user-editable metadata for access control
or presentation. Do not put passwords or real tokens in this file.

Keep `{{ .Token }}` intact. The code length is controlled by Supabase Auth
settings, not by the template. Real inbox delivery and responsive rendering
should be checked before inviting new members.
