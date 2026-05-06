-- Add stripe_payment_intent so we can match incoming charge.refunded /
-- charge.dispute.created webhooks. Those events only carry payment_intent
-- (`pi_...`), never the original checkout session id, so trying to look the
-- purchase up by stripe_session_id alone never finds it.
ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text;

CREATE INDEX IF NOT EXISTS idx_program_purchases_stripe_payment_intent
  ON program_purchases (stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;
