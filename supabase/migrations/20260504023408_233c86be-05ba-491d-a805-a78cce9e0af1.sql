REVOKE EXECUTE ON FUNCTION public.start_streaming_session(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.charge_streaming_session(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.end_streaming_session(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;