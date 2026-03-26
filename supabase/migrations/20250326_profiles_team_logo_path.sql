-- Oma joukkuelogo: polku Storage-bucketissa team-logos (esim. {user_id}/logo.png)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS team_logo_path text;

COMMENT ON COLUMN public.profiles.team_logo_path IS 'Supabase Storage: bucket team-logos, esim. uuid/logo.png';
