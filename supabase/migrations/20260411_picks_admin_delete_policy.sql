-- Massapoisto "Uusi kisa" -toiminnossa: RLS salli aiemmin vain "omat pickit" DELETE:nä,
-- jolloin muiden managerien rivit jäivät tietokantaan ilman virhettä.
-- Ehto vastaa appin ADMIN_EMAIL ja dashboardin "Kimmo can update all picks" -tyyppistä tunnistusta.
-- Jos käytät eri admin-sähköpostia, päivitä tämä tai lisää OR-ehto.

CREATE POLICY "Admin can delete all picks"
ON public.picks
FOR DELETE
TO authenticated
USING (
  lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'kimmo@gmail.com'
);
