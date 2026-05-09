CREATE OR REPLACE FUNCTION public.start_streaming_session(_user_id uuid)
 RETURNS TABLE(session_id uuid, credits integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prof RECORD;
  prior RECORD;
  new_id UUID;
  prof_credits INTEGER;
BEGIN
  SELECT p.id, p.credits, p.is_activated, p.is_admin
    INTO prof
  FROM public.profiles p
  WHERE p.id = _user_id
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

  FOR prior IN
    SELECT s.id FROM public.streaming_sessions s
    WHERE s.user_id = _user_id AND s.ended_at IS NULL
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

  prof_credits := prof.credits;
  RETURN QUERY SELECT new_id AS session_id, prof_credits AS credits;
END;
$function$;