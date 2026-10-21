-- Reversible catalog curation, not a data reset. Apply only after Drizzle 0020.
-- All market terms, statuses, activity and startup/video content are preserved.
BEGIN;
LOCK TABLE public.markets IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE owner_id uuid; before_terms jsonb; previous_listing jsonb; selected uuid[];
BEGIN
  SELECT p.id INTO STRICT owner_id FROM profiles p JOIN auth.users u ON u.id=p.id
    WHERE u.email='predictmitra@gmail.com' AND p.is_owner=1 AND p.banned_at IS NULL AND p.withdrawn_at IS NULL;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email='murugan.23@osu.edu' AND id='ffaf0f4e-dec8-400f-b542-388660a43b8c')
     OR owner_id <> '6b64e355-844f-4bf4-88ba-9781bd5bdc66' THEN RAISE EXCEPTION 'Unexpected project/owner identity'; END IF;
  IF (SELECT count(*) FROM markets) <> 40 THEN RAISE EXCEPTION 'Catalog changed; rerun the dry-run before curation'; END IF;
  IF EXISTS (SELECT 1 FROM admin_actions WHERE details->>'operation'='catalog_curation_2026_10_20') THEN RAISE EXCEPTION 'Already curated; do not rerun'; END IF;
  SELECT jsonb_agg(to_jsonb(m)-'listed' ORDER BY m.id), jsonb_agg(jsonb_build_object('id',m.id,'listed',m.listed) ORDER BY m.id)
    INTO before_terms,previous_listing FROM markets m;
  SELECT array_agg(m.id) INTO selected FROM markets m JOIN startups s ON s.id=m.startup_id
    JOIN (VALUES
      ('draftboard','Will Draftboard reach 50K weekly users by 2027?'),
      ('nexa-robotics','Will Nexa reach 10,000 active deployments by 2028?'),
      ('lumenly','Will Lumenly reach 100K verified monthly users by Dec 2027?'),
      ('pulsewell','Will Pulsewell get FDA clearance by end of 2027?'),
      ('stackwise','Will Stackwise be #1 on Product Hunt launch day?'),
      ('pixel-harbor','Will Tidepool crack the top 10 free games at launch?'),
      ('verdant-grid','Will Verdant Grid enroll 5,000 households by 2027?'),
      ('paystream','Will Paystream raise a $5M+ Series A by 2027?'),
      ('ferro-labs','Will Ferro Labs raise $500K on Kickstarter?'),
      ('parallax-ai','Will Parallax AI reach 100 plants by 2027?'),
      ('kestrel-aero','Will Kestrel Aero reach 1,000 farms by 2028?'),
      ('fieldnote','Will Fieldnote win the 2027 Open Learning Award?'),
      ('tidewell','Will Tidewell sign a 1,000-clinician health system?'),
      ('tracelight','Will Tracelight hit 100K weekly npm downloads?'),
      ('northstar-games','Will Driftlight release on Steam by June 30, 2027?'),
      ('carbonfold','Will a finished building use Carbonfold concrete by 2027?'),
      ('loop-closet','Will Loop Closet launch in a second city by mid-2027?'),
      ('orbit-kitchen','Will Orbit Kitchen pass 100K Android downloads?'),
      ('tally','Will Tally reach $1M in annual revenue by 2027?'),
      ('sona-audio','Will Sona Audio ship 10,000 earbuds by 2027?')
    ) AS wanted(slug,title) ON s.slug=wanted.slug AND m.short_question=wanted.title
    WHERE m.status='open' AND m.is_sample AND m.approved_at IS NOT NULL;
  IF cardinality(selected) IS DISTINCT FROM 20 THEN RAISE EXCEPTION 'Expected twenty existing open demonstration markets'; END IF;
  IF EXISTS (SELECT s.industry FROM markets m JOIN startups s ON s.id=m.startup_id WHERE m.id=ANY(selected) GROUP BY s.industry HAVING count(*)<>2) THEN RAISE EXCEPTION 'Expected two markets per industry'; END IF;
  UPDATE markets SET listed=(id=ANY(selected));
  IF (SELECT count(*) FROM markets WHERE listed)<>20
    OR (SELECT jsonb_agg(to_jsonb(m)-'listed' ORDER BY m.id) FROM markets m) IS DISTINCT FROM before_terms
    THEN RAISE EXCEPTION 'Curation preservation check failed'; END IF;
  INSERT INTO admin_actions(actor_user_id,kind,reason,details)
    VALUES(owner_id,'edit_market','Owner requested a few markets per category: two per industry; other definitions hidden, not deleted.',
      jsonb_build_object('operation','catalog_curation_2026_10_20','selected',to_jsonb(selected),'previous_listing',previous_listing));
END $$;
COMMIT;
