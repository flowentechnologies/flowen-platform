-- Dedicated private bucket for the investor pitch deck HTML. Previously the
-- app read it from the local filesystem (private/deck.html), but that
-- directory is gitignored (correctly — this repo is public on GitHub) which
-- meant the file never reached Vercel's deployed filesystem at all, only
-- ever existing on the developer's machine. Storing it in Supabase Storage
-- (private, fetched server-side with the service-role key) keeps the
-- content out of git entirely while making it actually available at
-- runtime — same token-gated access model as before via /api/pitch/[token].
insert into storage.buckets (id, name, public)
values ('pitch-deck', 'pitch-deck', false)
on conflict (id) do nothing;
