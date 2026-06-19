-- Cash-on-delivery (наложен платеж) order support.
-- Extends program_purchases so a buyer can place an order with shipping info
-- BEFORE having a clients row. Activation happens later via /start when the
-- buyer scans the QR on the postcard inside the envelope.
--
-- Flow:
--   1. create-cod-order edge fn inserts a row with payment_method='cod',
--      status='pending_delivery', client_id=NULL, activation_email=<the email
--      typed at order time>. No clients row is created yet.
--   2. activate-cod-order edge fn looks up by activation_email, creates the
--      clients row with the chosen password, links client_id, flips status
--      to 'active' and grants modules — same path as the Stripe webhook.

ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'stripe';

ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT;

ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS econt_tracking TEXT;

ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS shipping_name TEXT;

ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS shipping_phone TEXT;

ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS shipping_address TEXT;

-- The email entered on the order form. Used at /start to match the activation
-- request to the right pending order. Separate from clients.email because the
-- clients row doesn't exist yet at this point.
ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS activation_email TEXT;

ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

ALTER TABLE program_purchases
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- CoD purchases don't have a client_id at the moment they're created — the
-- client is materialised at activation time. Stripe purchases keep their
-- existing non-null guarantee through the edge fn, not the schema.
ALTER TABLE program_purchases
  ALTER COLUMN client_id DROP NOT NULL;

-- Constrain payment_method to known values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_purchases_payment_method_chk'
  ) THEN
    ALTER TABLE program_purchases
      ADD CONSTRAINT program_purchases_payment_method_chk
      CHECK (payment_method IN ('stripe', 'cod'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_purchases_fulfillment_chk'
  ) THEN
    ALTER TABLE program_purchases
      ADD CONSTRAINT program_purchases_fulfillment_chk
      CHECK (fulfillment_status IS NULL OR fulfillment_status IN ('pending', 'shipped', 'delivered', 'cancelled'));
  END IF;
END $$;

-- Case-insensitive lookup of pending orders by email at /start.
CREATE INDEX IF NOT EXISTS idx_program_purchases_activation_email
  ON program_purchases (LOWER(activation_email))
  WHERE payment_method = 'cod';

-- Reuse the same auth_attempts rate-limit table for the order form.
-- Permit a new action name; the existing schema already accepts arbitrary
-- action strings so nothing to alter — this is just a documentation comment.
--   action='create_cod_order' is rate-limited to 3 per IP per hour in the
--   create-cod-order edge function.

COMMENT ON COLUMN program_purchases.payment_method IS 'stripe | cod';
COMMENT ON COLUMN program_purchases.fulfillment_status IS 'pending | shipped | delivered | cancelled (CoD only)';
COMMENT ON COLUMN program_purchases.activation_email IS 'Email entered at order time; used to match /start activation to this row (CoD only)';
