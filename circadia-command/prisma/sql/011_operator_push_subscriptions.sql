-- Operator Web Push subscriptions for background triage alerts.

CREATE TABLE IF NOT EXISTS operator_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent VARCHAR(512),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operator_push_subscriptions_operator
  ON operator_push_subscriptions (operator_id);

CREATE TABLE IF NOT EXISTS push_dispatch_log (
  lifecycle_id UUID PRIMARY KEY,
  sent_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
