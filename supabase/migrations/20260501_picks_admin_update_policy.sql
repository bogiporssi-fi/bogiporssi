-- Admin voi korvata minkä tahansa managerin pick-rivin (pelaajavaihto ennen tai jälkeen lukituksen).
-- Sama tunniste kuin DELETE-policyssä (kimmo@gmail.com).
-- Idempotentti: uudelleenajo ei kaadu jos policy on jo olemassa.

DROP POLICY IF EXISTS "Admin can update all picks" ON public.picks;

CREATE POLICY "Admin can update all picks"
ON public.picks
FOR UPDATE
TO authenticated
USING (
  lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'kimmo@gmail.com'
)
WITH CHECK (
  lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'kimmo@gmail.com'
);
