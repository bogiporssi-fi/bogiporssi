-- Joukkueen valmis logo (id:t lib/teamLogos.ts — tiedostot public/team-logos/*.svg)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS team_logo_id text;

COMMENT ON COLUMN public.profiles.team_logo_id IS 'Valintavaihtoehto: bp-1 … bp-10 tai tyhjä';
