// Run once per environment: node --env-file=.env.local scripts/setup-evidence-storage.mjs
//
// Creates the buckets the app needs, and verifies their privacy afterwards
// rather than trusting the create call.
//
//   evidence-originals  private  what the subject actually sent, owner-only (2026-09-19)
//   profile-photos      private  re-encoded profile photos (2026-09-24), served
//                                only through the app's /photos route
//   photo-uploads       private  originals uploaded from the browser (2026-09-24),
//                                kept only until checked and re-encoded
//   media-uploads       private  founder photos, logos and thumbnails as uploaded
//                                (2026-10-19), kept only until re-encoded
//   startup-media       public   the re-encoded images and the founder videos
//                                (2026-10-19); the app shows them only once the
//                                owner approves, under unguessable paths
//
// startup-media is the only public bucket, and it holds only what founders
// chose to publish about their startup. No uploaded document is ever published:
// since the revision of 2026-09-19 what goes public about proof is a statement
// the owner wrote after reading it. An earlier version of this script created
// an "evidence-public" bucket; if your project still has one it is unused and
// can be removed in the Supabase dashboard.
//
// Founder uploads stay off until this has run and STARTUP_MEDIA_UPLOADS=on is
// set in the environment.
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
  {
    id: "profile-photos",
    public: false,
    // The app stores only the WebP it re-encoded itself, so nothing else is allowed.
    allowedMimeTypes: ["image/webp"],
    fileSizeLimit: 1024 * 1024,
    why: "photos are served through the app, so a ban or withdrawal stops them at once",
  },
  {
    id: "photo-uploads",
    public: false,
    // Browsers upload the original here, because Vercel refuses request bodies
    // over 4.5 MB. The app reads it, checks it and deletes it.
    allowedMimeTypes: IMAGE_TYPES,
    fileSizeLimit: 8 * 1024 * 1024,
    why: "holds originals with their metadata, including location, until the app strips it",
  },
  {
    id: "media-uploads",
    public: false,
    // Founder photos, logos and thumbnails as the browser sent them; the app
    // re-encodes each to WebP in startup-media and deletes the original.
    allowedMimeTypes: IMAGE_TYPES,
    fileSizeLimit: MAX_BYTES,
    why: "holds originals with their metadata, including location, until the app strips it",
  },
  {
    id: "startup-media",
    public: true,
    // Only the WebP images the app wrote itself, and founder videos.
    allowedMimeTypes: ["image/webp", "video/mp4", "video/webm"],
    fileSizeLimit: 50 * 1024 * 1024,
    why: "founder videos and startup images are shown to visitors who are not signed in",
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
  console.error("\nStorage is not correctly configured. Do not accept uploads until it is.");
  process.exitCode = 1;
} else {
  console.log("\nStorage is ready. Proof and photos are private and reach browsers only through the app.");
}
