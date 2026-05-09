-- Cost basis: $0.02 per usage second.
-- Activation fee: $50 (counted from rows in activation_orders).
-- Credits revenue: sum of credit_purchases.amount_usd where status='paid'.

-- ============================================================
-- View: admin_user_stats — per-user profit & activity
-- ============================================================
CREATE OR REPLACE VIEW public.admin_user_stats
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.is_activated,
  p.is_admin,
  p.credits,
  p.created_at AS joined_at,
  p.activated_at,
  COALESCE(u.total_seconds, 0)::bigint AS total_seconds,
  COALESCE(u.sessions, 0)::bigint AS sessions,
  COALESCE(ao.activation_count, 0)::bigint AS activation_orders,
  COALESCE(ao.activation_count, 0) * 50 AS activation_revenue,
  COALESCE(cp.credits_revenue, 0)::numeric AS credits_revenue,
  (COALESCE(ao.activation_count, 0) * 50 + COALESCE(cp.credits_revenue, 0))::numeric AS total_revenue,
  (COALESCE(u.total_seconds, 0) * 0.02)::numeric AS estimated_cost,
  ((COALESCE(ao.activation_count, 0) * 50 + COALESCE(cp.credits_revenue, 0))
    - (COALESCE(u.total_seconds, 0) * 0.02))::numeric AS estimated_profit
FROM public.profiles p
LEFT JOIN (
  SELECT user_id,
         SUM(seconds)::bigint AS total_seconds,
         COUNT(*)::bigint AS sessions
  FROM public.usage_logs
  GROUP BY user_id
) u ON u.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*)::bigint AS activation_count
  FROM public.activation_orders
  GROUP BY user_id
) ao ON ao.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(amount_usd)::numeric AS credits_revenue
  FROM public.credit_purchases
  WHERE status = 'paid'
  GROUP BY user_id
) cp ON cp.user_id = p.id;

-- ============================================================
-- View: admin_daily_metrics — last 60 days of signups, activations,
-- usage and revenue, one row per UTC day.
-- ============================================================
CREATE OR REPLACE VIEW public.admin_daily_metrics
WITH (security_invoker = true) AS
WITH days AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '59 days')::date,
    CURRENT_DATE,
    '1 day'
  )::date AS day
),
signups AS (
  SELECT created_at::date AS day, COUNT(*)::bigint AS n
  FROM public.profiles
  WHERE created_at >= CURRENT_DATE - INTERVAL '60 days'
  GROUP BY 1
),
activations AS (
  SELECT activated_at::date AS day, COUNT(*)::bigint AS n
  FROM public.profiles
  WHERE activated_at IS NOT NULL
    AND activated_at >= CURRENT_DATE - INTERVAL '60 days'
  GROUP BY 1
),
usage_per_day AS (
  SELECT created_at::date AS day, SUM(seconds)::bigint AS seconds
  FROM public.usage_logs
  WHERE created_at >= CURRENT_DATE - INTERVAL '60 days'
  GROUP BY 1
),
order_rev AS (
  SELECT created_at::date AS day, COUNT(*)::bigint * 50 AS revenue
  FROM public.activation_orders
  WHERE created_at >= CURRENT_DATE - INTERVAL '60 days'
  GROUP BY 1
),
purchase_rev AS (
  SELECT paid_at::date AS day, SUM(amount_usd)::numeric AS revenue
  FROM public.credit_purchases
  WHERE status = 'paid'
    AND paid_at IS NOT NULL
    AND paid_at >= CURRENT_DATE - INTERVAL '60 days'
  GROUP BY 1
)
SELECT
  d.day,
  COALESCE(s.n, 0)::bigint AS signups,
  COALESCE(a.n, 0)::bigint AS activations,
  COALESCE(up.seconds, 0)::bigint AS usage_seconds,
  (COALESCE(up.seconds, 0) * 0.02)::numeric AS estimated_cost,
  (COALESCE(o.revenue, 0) + COALESCE(pr.revenue, 0))::numeric AS revenue,
  ((COALESCE(o.revenue, 0) + COALESCE(pr.revenue, 0))
    - (COALESCE(up.seconds, 0) * 0.02))::numeric AS profit
FROM days d
LEFT JOIN signups s ON s.day = d.day
LEFT JOIN activations a ON a.day = d.day
LEFT JOIN usage_per_day up ON up.day = d.day
LEFT JOIN order_rev o ON o.day = d.day
LEFT JOIN purchase_rev pr ON pr.day = d.day
ORDER BY d.day;

-- ============================================================
-- View: admin_revenue_summary — single-row lifetime totals
-- ============================================================
CREATE OR REPLACE VIEW public.admin_revenue_summary
WITH (security_invoker = true) AS
SELECT
  (SELECT COUNT(*) FROM public.activation_orders)::bigint AS activations_count,
  ((SELECT COUNT(*) FROM public.activation_orders) * 50)::numeric AS activation_revenue,
  COALESCE((SELECT SUM(amount_usd) FROM public.credit_purchases WHERE status = 'paid'), 0)::numeric AS credits_revenue,
  ((SELECT COUNT(*) FROM public.activation_orders) * 50
    + COALESCE((SELECT SUM(amount_usd) FROM public.credit_purchases WHERE status='paid'), 0))::numeric AS total_revenue,
  COALESCE((SELECT SUM(seconds) FROM public.usage_logs), 0)::bigint AS total_seconds,
  (COALESCE((SELECT SUM(seconds) FROM public.usage_logs), 0) * 0.02)::numeric AS estimated_cost;

-- ============================================================
-- View: admin_alerts — pre-computed operational alerts
-- Severity: 'critical' | 'warning' | 'info'
-- ============================================================
CREATE OR REPLACE VIEW public.admin_alerts
WITH (security_invoker = true) AS
-- 1. Recent failed credit purchases
SELECT
  'failed_purchase_' || cp.id::text AS id,
  'critical'::text AS severity,
  'Failed credit purchase' AS title,
  ('Purchase ' || cp.plan || ' for $' || cp.amount_usd || ' failed')::text AS message,
  cp.created_at AS created_at,
  cp.user_id,
  'credit_purchase'::text AS source
FROM public.credit_purchases cp
WHERE cp.status = 'failed'
  AND cp.created_at >= now() - INTERVAL '30 days'

UNION ALL

-- 2. Stuck pending purchases older than 1 hour
SELECT
  'pending_purchase_' || cp.id::text,
  'warning',
  'Pending purchase stuck',
  ('Purchase ' || cp.plan || ' has been pending for over 1 hour')::text,
  cp.created_at,
  cp.user_id,
  'credit_purchase'
FROM public.credit_purchases cp
WHERE cp.status = 'pending'
  AND cp.created_at < now() - INTERVAL '1 hour'
  AND cp.created_at >= now() - INTERVAL '7 days'

UNION ALL

-- 3. Webhook signature failures in last 24h
SELECT
  'webhook_fail_' || wl.id::text,
  'critical',
  'Webhook signature failed',
  COALESCE(wl.error_message, 'Invalid signature on Atlos webhook'),
  wl.received_at,
  NULL::uuid,
  'webhook'
FROM public.atlos_webhook_logs wl
WHERE (wl.signature_valid = false OR (wl.response_code IS NOT NULL AND wl.response_code >= 400))
  AND wl.received_at >= now() - INTERVAL '24 hours'

UNION ALL

-- 4. Users who are unprofitable (cost > revenue)
SELECT
  'unprofitable_' || us.user_id::text,
  CASE WHEN us.estimated_profit < -10 THEN 'critical' ELSE 'warning' END,
  'Unprofitable user',
  ('User has $' || ROUND(us.estimated_profit::numeric, 2)
    || ' profit (' || us.total_seconds || 's used, $'
    || ROUND(us.total_revenue::numeric, 2) || ' revenue)')::text,
  COALESCE(us.activated_at, us.joined_at),
  us.user_id,
  'usage'
FROM public.admin_user_stats us
WHERE us.estimated_profit < 0
  AND us.is_activated = true

UNION ALL

-- 5. Activated users with no usage for 14+ days (engagement)
SELECT
  'inactive_' || p.id::text,
  'info',
  'Activated user inactive',
  'No usage in the last 14 days',
  p.activated_at,
  p.id,
  'engagement'
FROM public.profiles p
WHERE p.is_activated = true
  AND p.activated_at < now() - INTERVAL '14 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.usage_logs u
    WHERE u.user_id = p.id
      AND u.created_at >= now() - INTERVAL '14 days'
  );

-- ============================================================
-- Grants: only admins can read views (security_invoker honors caller RLS)
-- The underlying tables already have admin-read RLS, so views inherit it.
-- ============================================================
GRANT SELECT ON public.admin_user_stats TO authenticated;
GRANT SELECT ON public.admin_daily_metrics TO authenticated;
GRANT SELECT ON public.admin_revenue_summary TO authenticated;
GRANT SELECT ON public.admin_alerts TO authenticated;