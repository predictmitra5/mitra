-- Reversible change to which demonstration markets are listed, not a data reset
-- (DECISIONS.md 2026-10-21, "The app's listing, agreed the same day"). Hides
-- three demo markets the owner called easy to fake (a founder-set release date,
-- a founder-set launch, crowdfunding pledges) and lists six hidden open ones
-- that someone other than the founder decides. Only `listed` changes: every
-- market's terms, status and activity are asserted unchanged, and the previous
-- listing goes into an owner audit entry. To undo, set each market's `listed`
-- back from that entry's details->'previous_listing'.
BEGIN;
LOCK TABLE public.markets IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE owner_id uuid; before_terms jsonb; previous_listing jsonb; to_hide uuid[]; to_list uuid[];
BEGIN
  SELECT p.id INTO STRICT owner_id FROM profiles p JOIN auth.users u ON u.id=p.id
    WHERE u.email='predictmitra@gmail.com' AND p.is_owner=1 AND p.banned_at IS NULL AND p.withdrawn_at IS NULL;
  IF (SELECT count(*) FROM markets) <> 40 OR (SELECT count(*) FROM markets WHERE listed) <> 20 THEN
    RAISE EXCEPTION 'Catalog or listing changed since the 2026-10-21 dry run; look again before applying'; END IF;
  IF EXISTS (SELECT 1 FROM admin_actions WHERE details->>'operation'='catalog_listing_2026_10_21') THEN
    RAISE EXCEPTION 'Already applied; do not rerun'; END IF;
  SELECT jsonb_agg(to_jsonb(m)-'listed' ORDER BY m.id), jsonb_agg(jsonb_build_object('id',m.id,'listed',m.listed) ORDER BY m.id)
    INTO before_terms,previous_listing FROM markets m;
  SELECT array_agg(m.id) INTO to_hide FROM markets m JOIN startups s ON s.id=m.startup_id
    JOIN (VALUES
      ('northstar-games','Will Driftlight release on Steam by June 30, 2027?'),
      ('loop-closet','Will Loop Closet launch in a second city by mid-2027?'),
      ('ferro-labs','Will Ferro Labs raise $500K on Kickstarter?')
    ) AS wanted(slug,title) ON s.slug=wanted.slug AND m.short_question=wanted.title
    WHERE m.listed AND m.status='open' AND m.is_sample AND m.approved_at IS NOT NULL;
  SELECT array_agg(m.id) INTO to_list FROM markets m JOIN startups s ON s.id=m.startup_id
    JOIN (VALUES
      ('lumenly','Will Lumenly get into Y Combinator by mid-2027?'),
      ('nexa-robotics','Will Nexa Robotics win the 2027 Open Automation Prize?'),
      ('draftboard','Will Draftboard be acquired by 2028?'),
      ('parallax-ai','Will Parallax AI get into the Foundry accelerator?'),
      ('verdant-grid','Will Verdant Grid win the 2027 Gridshift Prize?'),
      ('carbonfold','Will Carbonfold win the Material Futures Challenge?')
    ) AS wanted(slug,title) ON s.slug=wanted.slug AND m.short_question=wanted.title
    WHERE NOT m.listed AND m.status='open' AND m.is_sample AND m.approved_at IS NOT NULL;
  IF cardinality(to_hide) IS DISTINCT FROM 3 OR cardinality(to_list) IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION 'Expected three listed markets to hide and six hidden open markets to list'; END IF;
  UPDATE markets SET listed=false WHERE id=ANY(to_hide);
  UPDATE markets SET listed=true WHERE id=ANY(to_list);
  IF (SELECT count(*) FROM markets WHERE listed)<>23
    OR (SELECT jsonb_agg(to_jsonb(m)-'listed' ORDER BY m.id) FROM markets m) IS DISTINCT FROM before_terms
    THEN RAISE EXCEPTION 'Listing preservation check failed'; END IF;
  INSERT INTO admin_actions(actor_user_id,kind,reason,details)
    VALUES(owner_id,'edit_market','Owner asked to hide demo markets that are easy to fake (a founder-set release or launch, crowdfunding pledges) and to list hidden ones that someone else decides.',
      jsonb_build_object('operation','catalog_listing_2026_10_21','hidden',to_jsonb(to_hide),'listed',to_jsonb(to_list),'previous_listing',previous_listing));
END $$;
COMMIT;
