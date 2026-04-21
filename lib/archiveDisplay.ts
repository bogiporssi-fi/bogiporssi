/** Sama merkkijono kuin Admin-panelin INSERT (Hot/HIO ilman joukkuevalintaa). */
export const ARCHIVE_HOT_HIO_AUX_TEAM_NAME = 'Ei joukkuevalintaa';

/**
 * Kenttäpelaajan tulos ilman fantasy-valintaa (arkistointi).
 * Ei näytetä kisa-arkiston joukkuenäkymässä eikä joukkueiden kausitauluissa — vain pelaajakohtainen kausi / tilastot.
 */
export const ARCHIVE_FIELD_SNAPSHOT_TEAM_NAME = 'Kenttätulos (ei fantasy-valintaa)';

/** Rivit jotka on tarkoitettu vain Hall of Famen hot/hio -laskentaan — ei tulostauluja / historiaa. */
export function isArchiveHotHioAuxRow(row: any): boolean {
  return String(row?.team_name || '') === ARCHIVE_HOT_HIO_AUX_TEAM_NAME;
}

export function isArchiveFieldSnapshotRow(row: any): boolean {
  return String(row?.team_name || '') === ARCHIVE_FIELD_SNAPSHOT_TEAM_NAME;
}

export function historyRowsForDisplay(history: any[] | undefined): any[] {
  return (history || []).filter((row) => !isArchiveHotHioAuxRow(row));
}
