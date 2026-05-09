-- Streaming sessions: server-owned single-active-session enforcement
CREATE TABLE public.streaming_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  seconds_charged INTEGER NOT NULL DEFAULT 0,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one open (not-yet-ended) session per user
CREATE UNIQUE INDEX streaming_sessions_one_active_per_user
  ON public.streaming_sessions (user_id)
  WHERE ended_at IS NULL;

CREATE INDEX streaming_sessions_user_id_idx ON public.streaming_sessions (user_id);

ALTER TABLE public.streaming_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streaming sessions"
  ON public.streaming_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all streaming sessions"
  ON public.streaming_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policies — only service role (via RPCs) can mutate.

-- =========================================================================
-- Atomic charge: deduct credits for the delta between requested seconds
-- and already-charged seconds, locking the profile row to prevent races.
-- Returns new credit balance and seconds actually charged this call.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.charge_streaming_session(
  _session_id UUID,
  _user_id UUID,
  _total_seconds INTEGER
)
RETURNS TABLE(credits INTEGER, charged_seconds INTEGER, ended BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  CREDITS_PER_SECOND CONSTANT INTEGER := 2;
  sess RECORD;
  delta_seconds INTEGER;
  cost INTEGER;
  current_credits INTEGER;
  new_credits INTEGER;
  affordable_seconds INTEGER;
  must_end BOOLEAN := FALSE;
BEGIN
  IF _total_seconds IS NULL OR _total_seconds < 0 THEN
    RAISE EXCEPTION 'charge_streaming_session: invalid seconds';
  END IF;

  -- Lock the session row first
  SELECT * INTO sess FROM public.streaming_sessions
  WHERE id = _session_id AND user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STREAMING_SESSION_NOT_FOUND';
  END IF;

  IF sess.ended_at IS NOT NULL THEN
    RETURN QUERY SELECT
      (SELECT p.credits FROM public.profiles p WHERE p.id = _user_id),
      0,
      TRUE;
    RETURN;
  END IF;

  delta_seconds := _total_seconds - sess.seconds_charged;
  IF delta_seconds < 0 THEN delta_seconds := 0; END IF;

  IF delta_seconds = 0 THEN
    UPDATE public.streaming_sessions
      SET last_heartbeat_at = now()
      WHERE id = _session_id;
    RETURN QUERY SELECT
      (SELECT p.credits FROM public.profiles p WHERE p.id = _user_id),
      0,
      FALSE;
    RETURN;
  END IF;

  -- Lock the profile row to atomically deduct credits
  SELECT p.credits INTO current_credits
  FROM public.profiles p
  WHERE p.id = _user_id
  FOR UPDATE;

  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  cost := delta_seconds * CREDITS_PER_SECOND;

  IF cost > current_credits THEN
    -- Charge what we can, end session
    affordable_seconds := current_credits / CREDITS_PER_SECOND;
    cost := affordable_seconds * CREDITS_PER_SECOND;
    delta_seconds := affordable_seconds;
    must_end := TRUE;
  END IF;

  new_credits := current_credits - cost;

  UPDATE public.profiles
    SET credits = new_credits
    WHERE id = _user_id;

  UPDATE public.streaming_sessions
    SET seconds_charged = seconds_charged + delta_seconds,
        last_heartbeat_at = now(),
        ended_at = CASE WHEN must_end THEN now() ELSE ended_at END,
        end_reason = CASE WHEN must_end THEN 'insufficient_credits' ELSE end_reason END
    WHERE id = _session_id;

  RETURN QUERY SELECT new_credits, delta_seconds, must_end;
END;
$$;

-- =========================================================================
-- Start a session: enforce single-active by closing any prior open session
-- for the user (charging any unbilled time first), then create a new one.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.start_streaming_session(_user_id UUID)
RETURNS TABLE(session_id UUID, credits INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof RECORD;
  prior RECORD;
  new_id UUID;
BEGIN
  -- Lock profile to read activation + credits coherently
  SELECT id, credits, is_activated, is_admin
    INTO prof
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF NOT prof.is_activated AND NOT prof.is_admin THEN
    RAISE EXCEPTION 'NOT_ACTIVATED';
  END IF;

  IF prof.credits < 2 THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  -- Close any prior open session (no extra charge — last heartbeat already
  -- recorded what we billed). This frees the partial unique index.
  FOR prior IN
    SELECT id FROM public.streaming_sessions
    WHERE user_id = _user_id AND ended_at IS NULL
    FOR UPDATE
  LOOP
    UPDATE public.streaming_sessions
      SET ended_at = now(),
          end_reason = COALESCE(end_reason, 'superseded')
      WHERE id = prior.id;
  END LOOP;

  INSERT INTO public.streaming_sessions (user_id)
  VALUES (_user_id)
  RETURNING id INTO new_id;

  RETURN QUERY SELECT new_id, prof.credits;
END;
$$;

-- =========================================================================
-- End a session: optionally charge remaining unbilled seconds atomically.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.end_streaming_session(
  _session_id UUID,
  _user_id UUID,
  _total_seconds INTEGER DEFAULT NULL,
  _reason TEXT DEFAULT 'client_end'
)
RETURNS TABLE(credits INTEGER, charged_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  charge_result RECORD;
  charged INTEGER := 0;
  bal INTEGER;
BEGIN
  IF _total_seconds IS NOT NULL AND _total_seconds > 0 THEN
    SELECT * INTO charge_result
    FROM public.charge_streaming_session(_session_id, _user_id, _total_seconds);
    charged := charge_result.charged_seconds;
  END IF;

  UPDATE public.streaming_sessions
    SET ended_at = COALESCE(ended_at, now()),
        end_reason = COALESCE(end_reason, _reason),
        last_heartbeat_at = now()
    WHERE id = _session_id AND user_id = _user_id;

  SELECT p.credits INTO bal FROM public.profiles p WHERE p.id = _user_id;
  RETURN QUERY SELECT bal, charged;
END;
$$;