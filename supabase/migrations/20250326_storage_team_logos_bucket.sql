-- Aja tämä Supabasessa SQL-editorissa Storage-bucketin ja käytäntöjen luontiin.
-- Vaihtoehto: Dashboard → Storage → New bucket → id: team-logos → Public bucket ✓

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'team-logos',
  'team-logos',
  true,
  2097152
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Poista vanhat käytännöt jos uudelleenajossa (nimet täytyy olla uniikkeja — tarvittaessa droppaa ensin Dashboardista)
DROP POLICY IF EXISTS "team_logos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "team_logos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "team_logos_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "team_logos_select_public" ON storage.objects;

-- Kuka tahansa voi lukea julkisen bucketin tiedostot (URL img-tageissa)
CREATE POLICY "team_logos_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'team-logos');

-- Kirjautunut saa ladata/päivittää/poistaa vain oman kansion (polku: {uid}/logo.ext)
CREATE POLICY "team_logos_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-logos'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "team_logos_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "team_logos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND split_part(name, '/', 1) = auth.uid()::text
);
