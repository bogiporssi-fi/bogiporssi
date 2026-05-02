/** Sama osoite kuin Supabasen RLS-policyissa picks DELETE/UPDATE (alempi-case vertailu). */
const raw = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim();
export const ADMIN_EMAIL =
  raw && raw.length > 0 ? raw.toLowerCase() : 'kimmo@gmail.com';
