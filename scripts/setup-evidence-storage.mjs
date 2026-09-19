// Run once per environment: node --env-file=.env.local scripts/setup-evidence-storage.mjs
//
// Creates the two buckets the evidence decision of 2026-09-19 requires, and
// verifies their privacy afterwards rather than trusting the create call.
//
//   evidence-originals  private  what the subject actually sent, owner-only
//   evidence-public     public   only artifacts the owner approved, already redacted
//
// Safe to run repeatedly. It never deletes a bucket or anything inside one, and
// it refuses to continue if an existing bucket has the wrong privacy.
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
    allowedMimeTypes: IMAGE_TYPES,
    fileSizeLimit: MAX_BYTES,
    why: "holds unredacted documents; must never be readable without server-side authorisation",
  },
  {
    id: "evidence-public",
    public: true,
    allowedMimeTypes: ["image/png"],
    fileSizeLimit: MAX_BYTES,
    why: "holds only approved, pixel-destroyed artifacts",
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
    console.log(`${bucket.id} already exists.`);
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
  console.log("\nEvidence storage is ready. Originals are private; only approved redactions are public.");
}
