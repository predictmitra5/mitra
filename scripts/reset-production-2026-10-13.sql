-- One-time, owner-authorized reset. The owner confirmed a private recoverable
-- backup and Auth/Storage cleanup before execution. No Auth/Storage rows are changed.
-- Retain both owners, all five markets and frozen terms/statuses, reference
-- catalogs and owner QR configuration. Clear historical activity and balances.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';
lock table auth.users in share mode;
lock table public.profiles, public.wallets, public.silver_wallets,
  public.ledger_entries, public.silver_ledger_entries, public.markets,
  public.market_outcome_deciders, public.positions, public.trades,
  public.price_history, public.admin_actions, public.contests,
  public.feed_events, public.feed_event_buckets, public.upload_intents,
  public.evidence, public.market_proposals, public.user_badges,
  public.purchase_orders, public.campus_qr_campaigns, public.campus_qr_claims
  in access exclusive mode;

do $reset$
declare
  retained_ids uuid[];
  market_fingerprint text;
  remaining_history bigint;
begin
  select array_agg(p.id order by p.id) into retained_ids
  from public.profiles p join auth.users u on u.id = p.id
  where u.email in ('murugan.23@osu.edu', 'predictmitra@gmail.com')
    and p.is_owner = 1 and p.withdrawn_at is null and p.banned_at is null
    and p.adult_confirmed_at is not null;
  if coalesce(array_length(retained_ids, 1), 0) <> 2
    or (select count(*) from auth.users) <> 2
    or (select count(*) from public.profiles where is_owner = 1) <> 2 then
    raise exception 'Reset aborted: the two expected owners must be the only Auth identities.';
  end if;
  if (select count(*) from public.markets) <> 5 then
    raise exception 'Reset aborted: expected exactly five retained markets.';
  end if;
  if exists (select 1 from public.markets
    where (subject_user_id is not null and not (subject_user_id = any(retained_ids)))
       or (approved_by is not null and not (approved_by = any(retained_ids)))) then
    raise exception 'Reset aborted: a retained market references a non-owner.';
  end if;
  if exists (select 1 from storage.objects
    where bucket_id <> 'profile-photos'
      or not (split_part(name, '/', 1) = any(retained_ids::text[]))) then
    raise exception 'Reset aborted: non-owner Storage cleanup is incomplete.';
  end if;
  if exists (select 1 from public.purchase_orders where status = 'paid') then
    raise exception 'Reset aborted: an unexpected real purchase requires review.';
  end if;

  select md5(jsonb_agg(to_jsonb(m) - array['opening_probability_bp',
    'initial_yes_shares_micro', 'initial_no_shares_micro', 'yes_shares_micro',
    'no_shares_micro'] order by m.id)::text) into market_fingerprint
  from public.markets m;

  delete from public.campus_qr_claims;
  delete from public.user_badges;
  delete from public.silver_ledger_entries;
  delete from public.purchase_orders;
  delete from public.ledger_entries;
  delete from public.price_history;
  delete from public.positions;
  delete from public.trades;
  delete from public.contests;
  delete from public.evidence;
  delete from public.upload_intents;
  delete from public.market_proposals;
  delete from public.feed_events;
  delete from public.feed_event_buckets;
  delete from public.admin_actions;
  delete from public.market_outcome_deciders where not (user_id = any(retained_ids));
  delete from public.campus_qr_campaigns where not (created_by = any(retained_ids));
  update public.campus_qr_campaigns set active = false;

  delete from public.wallets where not (user_id = any(retained_ids));
  delete from public.silver_wallets where not (user_id = any(retained_ids));
  delete from public.profiles where not (id = any(retained_ids));
  insert into public.wallets (user_id, balance_micro, updated_at)
    select unnest(retained_ids), 0, now()
    on conflict (user_id) do update set balance_micro = 0, updated_at = excluded.updated_at;
  insert into public.silver_wallets (user_id, balance, updated_at)
    select unnest(retained_ids), 0, now()
    on conflict (user_id) do update set balance = 0, updated_at = excluded.updated_at;

  update public.markets set opening_probability_bp = 5000,
    initial_yes_shares_micro = 0, initial_no_shares_micro = 0,
    yes_shares_micro = 0, no_shares_micro = 0;
  update public.profiles p set photo_path = null, photo_updated_at = null
    where p.photo_path is not null and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'profile-photos' and o.name = p.photo_path);

  select (select count(*) from public.campus_qr_claims)
    + (select count(*) from public.user_badges)
    + (select count(*) from public.silver_ledger_entries)
    + (select count(*) from public.purchase_orders)
    + (select count(*) from public.ledger_entries)
    + (select count(*) from public.price_history)
    + (select count(*) from public.positions)
    + (select count(*) from public.trades)
    + (select count(*) from public.contests)
    + (select count(*) from public.evidence)
    + (select count(*) from public.upload_intents)
    + (select count(*) from public.market_proposals)
    + (select count(*) from public.feed_events)
    + (select count(*) from public.feed_event_buckets)
    + (select count(*) from public.admin_actions) into remaining_history;
  if remaining_history <> 0
    or (select count(*) from public.profiles) <> 2
    or (select count(*) from public.wallets) <> 2
    or (select count(*) from public.silver_wallets) <> 2
    or exists (select 1 from public.wallets where balance_micro <> 0)
    or exists (select 1 from public.silver_wallets where balance <> 0)
    or exists (select 1 from public.campus_qr_campaigns where active)
    or exists (select 1 from public.markets where opening_probability_bp <> 5000
      or yes_shares_micro <> 0 or no_shares_micro <> 0
      or initial_yes_shares_micro <> 0 or initial_no_shares_micro <> 0) then
    raise exception 'Reset aborted: post-reset invariants failed.';
  end if;
  if market_fingerprint is distinct from (select md5(jsonb_agg(to_jsonb(m)
    - array['opening_probability_bp', 'initial_yes_shares_micro',
      'initial_no_shares_micro', 'yes_shares_micro', 'no_shares_micro']
    order by m.id)::text) from public.markets m) then
    raise exception 'Reset aborted: retained market terms/statuses changed.';
  end if;
end;
$reset$;
commit;
