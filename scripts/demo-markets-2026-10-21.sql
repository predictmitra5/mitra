-- Two demonstration markets the owner chose on 2026-10-21 (DECISIONS.md, "New
-- demo markets, chosen the same day"), worded as in src/modules/startups/demo/
-- catalog.ts and built as the demo seed builds its markets: a resolution
-- source, the market open at the 50% opening with no shares, approved by the
-- owner and listed, the seed's demo rules text, and an owner approval entry.
-- Nothing existing changes: the 40 markets before it are asserted unchanged.
BEGIN;
LOCK TABLE public.markets IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE owner_id uuid; before_rows jsonb; loop_id uuid; harbor_id uuid; source_id uuid; market_id uuid;
BEGIN
  SELECT p.id INTO STRICT owner_id FROM profiles p JOIN auth.users u ON u.id=p.id
    WHERE u.email='predictmitra@gmail.com' AND p.is_owner=1 AND p.banned_at IS NULL AND p.withdrawn_at IS NULL;
  SELECT id INTO STRICT loop_id FROM startups WHERE slug='loop-closet' AND status='approved';
  SELECT id INTO STRICT harbor_id FROM startups WHERE slug='pixel-harbor' AND status='approved';
  IF (SELECT count(*) FROM markets) <> 40 OR (SELECT count(*) FROM markets WHERE listed) <> 23 THEN
    RAISE EXCEPTION 'Markets changed since the 2026-10-21 dry run; look again before applying'; END IF;
  IF EXISTS (SELECT 1 FROM markets WHERE short_question IN ('Will Loop Closet raise a $2M+ seed round by 2027?','Will Tidepool be an Apple Design Award finalist in 2027?')) THEN
    RAISE EXCEPTION 'Already added; do not rerun'; END IF;
  SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) INTO before_rows FROM markets m;

  INSERT INTO resolution_sources(name,method,operational)
    VALUES('Company or lead investor announcement','A public announcement by the company or its lead investor; priced equity or SAFEs count, loans and grants do not. Demonstration market: financial milestones need legal review before any real-money use.',false)
    RETURNING id INTO source_id;
  INSERT INTO markets(status,question,short_question,resolution_criteria,startup_id,milestone_kind,resolution_source_id,time_zone,yes_condition,no_condition,
      is_sample,deadline_at,evidence_deadline_at,liquidity_micro,opening_probability_bp,initial_yes_shares_micro,initial_no_shares_micro,yes_shares_micro,no_shares_micro,
      approved_at,approved_by,listed)
    VALUES('open','Will Loop Closet publicly announce a seed round of at least $2 million by December 31, 2027?','Will Loop Closet raise a $2M+ seed round by 2027?',
      'A public announcement by the company or its lead investor; priced equity or SAFEs count, loans and grants do not. Demonstration market: financial milestones need legal review before any real-money use.'
        || E'\n\n' || 'Source: Company or lead investor announcement.'
        || E'\n\n' || 'If that source is unavailable at the deadline, the owner checks the company''s own public announcement and at least one independent report. If sources conflict, the more conservative figure counts. If nothing can be verified within 14 days after the deadline, the market is void; missing data never determines No.'
        || E'\n\n' || 'Loop Closet''s founders and anyone who manages its profile cannot trade this market. Only the Mitra owner settles it.'
        || E'\n\n' || 'Demo market: Loop Closet, its founders and every number here are fictional, for demonstrating Mitra. No financial activity is simulated or funded.',
      loop_id,'financial',source_id,'America/New_York',
      'Loop Closet or its lead investor publicly announces a seed round of at least $2,000,000 on or before December 31, 2027.','No such announcement by then.',
      true,'2027-12-31T23:59:59-05:00','2027-12-31T23:59:59-05:00'::timestamptz + interval '14 days',0,5000,0,0,0,0,now(),owner_id,true)
    RETURNING id INTO market_id;
  INSERT INTO admin_actions(market_id,actor_user_id,kind,reason,details)
    VALUES(market_id,owner_id,'approve','Demo market added at the owner''s choice (DECISIONS.md 2026-10-21).',
      jsonb_build_object('question','Will Loop Closet publicly announce a seed round of at least $2 million by December 31, 2027?','openingProbabilityBp',5000,'isSample',true,'demo',true,'operation','demo_markets_2026_10_21'));

  INSERT INTO resolution_sources(name,method,operational)
    VALUES('Apple Design Awards page','Finalists and winners as published on Apple''s Apple Design Awards page; other App Store features and editorial picks do not count.',false)
    RETURNING id INTO source_id;
  INSERT INTO markets(status,question,short_question,resolution_criteria,startup_id,milestone_kind,resolution_source_id,time_zone,yes_condition,no_condition,
      is_sample,deadline_at,evidence_deadline_at,liquidity_micro,opening_probability_bp,initial_yes_shares_micro,initial_no_shares_micro,yes_shares_micro,no_shares_micro,
      approved_at,approved_by,listed)
    VALUES('open','Will Tidepool be named a finalist or winner of Apple''s 2027 Apple Design Awards by June 30, 2027?','Will Tidepool be an Apple Design Award finalist in 2027?',
      'Finalists and winners as published on Apple''s Apple Design Awards page; other App Store features and editorial picks do not count.'
        || E'\n\n' || 'Source: Apple Design Awards page.'
        || E'\n\n' || 'If that source is unavailable at the deadline, the owner checks the company''s own public announcement and at least one independent report. If sources conflict, the more conservative figure counts. If nothing can be verified within 14 days after the deadline, the market is void; missing data never determines No.'
        || E'\n\n' || 'Pixel Harbor''s founders and anyone who manages its profile cannot trade this market. Only the Mitra owner settles it.'
        || E'\n\n' || 'Demo market: Pixel Harbor, its founders and every number here are fictional, for demonstrating Mitra. No financial activity is simulated or funded.',
      harbor_id,'award',source_id,'America/New_York',
      'Apple lists Tidepool among the finalists or winners of its 2027 Apple Design Awards on or before June 30, 2027.','Tidepool is not listed, or Apple names no 2027 finalists or winners by then.',
      true,'2027-06-30T23:59:59-04:00','2027-06-30T23:59:59-04:00'::timestamptz + interval '14 days',0,5000,0,0,0,0,now(),owner_id,true)
    RETURNING id INTO market_id;
  INSERT INTO admin_actions(market_id,actor_user_id,kind,reason,details)
    VALUES(market_id,owner_id,'approve','Demo market added at the owner''s choice (DECISIONS.md 2026-10-21).',
      jsonb_build_object('question','Will Tidepool be named a finalist or winner of Apple''s 2027 Apple Design Awards by June 30, 2027?','openingProbabilityBp',5000,'isSample',true,'demo',true,'operation','demo_markets_2026_10_21'));

  IF (SELECT count(*) FROM markets) <> 42 OR (SELECT count(*) FROM markets WHERE listed) <> 25
    OR (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM markets m WHERE m.id IN (SELECT (r->>'id')::uuid FROM jsonb_array_elements(before_rows) r)) IS DISTINCT FROM before_rows
    THEN RAISE EXCEPTION 'Preservation check failed'; END IF;
END $$;
COMMIT;
