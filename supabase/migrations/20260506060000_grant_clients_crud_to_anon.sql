-- Restore SELECT/INSERT/UPDATE permissions on `clients` for anon and authenticated.
--
-- Some earlier migration narrowed the grants down to just DELETE, which broke
-- direct PATCH/POST calls from the frontend (e.g. saving the SYNRG quiz, or
-- updating module modules in BookingContext). RLS policies on this table are
-- already permissive (`USING true`), so reinstating the grants is safe and
-- mirrors how other public tables (meals, weight_logs, client_program_state)
-- are configured.
GRANT SELECT, INSERT, UPDATE ON public.clients TO anon;
GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
