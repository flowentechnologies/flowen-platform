-- Enable Supabase Realtime for slp_messages so the browser client can
-- subscribe to INSERT/UPDATE events without polling.
ALTER PUBLICATION supabase_realtime ADD TABLE slp_messages;
