// Run once per environment: node --env-file=.env.local scripts/setup-evidence-storage.mjs
//
// Creates the one bucket the evidence decision of 2026-09-19 requires, and
// verifies its privacy afterwards rather than trusting the create call.
//
//   evidence-originals  private  what the subject actually sent, owner-only
//
// There is deliberately no public bucket. Since the revision of 2026-09-19 no
// uploaded document is ever published: what goes public is a statement the
// owner wrote after reading it. An earlier version of this script created an
// "evidence-public" bucket; if your project still has one it is unused and can
// be removed in the Supabase dashboard.
//
// Safe to run repeatedly. It never deletes a bucket or anything inside one, and
// it refuses to continue if the bucket has the wrong privacy.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

const wanted = [
  {
    id: "evidence-originals",
    public: false,
    allowedMimeTypes: [...IMAGE_TYPES, "application/pdf"],
    fileSizeLimit: MAX_BYTES,
    why: "holds people's actual documents; must never be readable without server-side authorisation",
  },
];

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let failed = false;

for (const bucket of wanted) {
  const { data: existing } = await supabase.storage.getBucket(bucket.id);

  if (!existing) {
    const { error } = await supabase.storage.createBucket(bucket.id, {
      public: bucket.public,
      allowedMimeTypes: bucket.allowedMimeTypes,
      fileSizeLimit: bucket.fileSizeLimit,
    });
    if (error) {
      console.error(`Could not create ${bucket.id}: ${error.message}`);
      failed = true;
      continue;
    }
    console.log(`Created ${bucket.id} (${bucket.public ? "public" : "private"}) - ${bucket.why}`);
  } else {
    // An existing bucket keeps whatever it was created with, so bring its
    // limits up to date. PDFs were not accepted under the redaction design and
    // would otherwise still be rejected by storage itself.
    const { error } = await supabase.storage.updateBucket(bucket.id, {
      public: bucket.public,
      allowedMimeTypes: bucket.allowedMimeTypes,
      fileSizeLimit: bucket.fileSizeLimit,
    });
    if (error) {
      console.error(`Could not update ${bucket.id}: ${error.message}`);
      failed = true;
      continue;
    }
    console.log(`${bucket.id} already exists; limits brought up to date.`);
  }

  // Verify rather than assume: read the bucket back and check what it says.
  const { data: confirmed, error } = await supabase.storage.getBucket(bucket.id);
  if (error || !confirmed) {
    console.error(`Could not read ${bucket.id} back to verify it.`);
    failed = true;
    continue;
  }
  if (confirmed.public !== bucket.public) {
    console.error(
      `WRONG PRIVACY on ${bucket.id}: it is ${confirmed.public ? "public" : "private"} and must be ` +
      `${bucket.public ? "public" : "private"}. ${bucket.why}. Fix this in the Supabase dashboard before using it.`,
    );
    failed = true;
    continue;
  }
  console.log(`  verified: ${confirmed.public ? "public" : "private"}`);
}

if (failed) {
  console.error("\nEvidence storage is not correctly configured. Do not accept uploads until it is.");
  process.exitCode = 1;
} else {
  console.log("\nEvidence storage is ready. Every uploaded document is private and stays that way.");
}
