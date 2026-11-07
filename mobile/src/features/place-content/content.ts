import bundled from './catalog.json';

export type Catalog = typeof bundled;
type Place = Catalog['places'][number];
type Entry = Catalog['entries'][number];
type Source = Catalog['sources'][number];
export type ContentResult<T> = { status: 'ok'; data: T }
  | { status: 'not-found' | 'unavailable' }
  | { status: 'error'; code: 'INVALID_ARGUMENT' | 'TARGET_MISMATCH' };

/** Read-only content. Does not interpret model scores or persist user messages. */
export function createPlaceContent(data: Catalog) {
  const source = (id: string) => data.sources.find(s => s.id === id);
  const safeSource = (s: Source | undefined): s is Source => {
    if (!s?.publisher || !s.title || !s.checkedAt) return false;
    try { return new URL(s.url).protocol === 'https:'; } catch { return false; }
  };
  const entry = (id: string, placeId: string): ContentResult<Entry> => {
    if (!id.trim() || !placeId.trim()) return { status: 'error', code: 'INVALID_ARGUMENT' };
    const item = data.entries.find(e => e.id === id);
    if (!item) return { status: 'not-found' };
    if (item.placeId !== placeId) return { status: 'error', code: 'TARGET_MISMATCH' };
    if (!item.reviewed || !item.body.trim() || !item.title.trim() || !item.sourceIds.length
      || item.sourceIds.some(id => !safeSource(source(id)))) return { status: 'unavailable' };
    return { status: 'ok', data: item };
  };
  const building = (id: string): ContentResult<Place> => {
    const place = data.places.find(p => p.id === id);
    if (!id.trim()) return { status: 'error', code: 'INVALID_ARGUMENT' };
    if (!place) return { status: 'not-found' };
    if (!place.name.trim() || !place.entryIds.length || place.entryIds.some(id => entry(id, place.id).status !== 'ok')) return { status: 'unavailable' };
    return { status: 'ok', data: place };
  };
  return {
    getStartOptions: () => [{ kind: 'direct-selection' as const }, { kind: 'camera' as const }, { kind: 'library' as const }],
    listBuildings: () => data.places.filter(p => building(p.id).status === 'ok'),
    searchBuildings(query: string) {
      const normalize = (value: string) => value.normalize('NFC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
      const term = normalize(query);
      return data.places.filter(p => building(p.id).status === 'ok' && normalize(p.name).includes(term));
    },
    getBuilding: building,
    getEntry: entry,
    getSource(id: string): ContentResult<Source> {
      const item = source(id);
      return !item ? { status: 'not-found' } : safeSource(item) ? { status: 'ok', data: item } : { status: 'unavailable' };
    },
    getPhoto(placeId: string) {
      const place = data.places.find(p => p.id === placeId);
      return data.assets.find(a => a.id === place?.assetId && a.placeId === placeId
        && a.license && a.licenseUrl && a.credit && safeSource(source(a.sourceId))) ?? null;
    },
    async openSource(id: string, openUrl: (url: string) => Promise<unknown>): Promise<{ status: 'opened' } | { status: 'error'; code: 'SOURCE_NOT_FOUND' | 'SOURCE_OPEN_FAILED' }> {
      const item = source(id);
      if (!item) return { status: 'error', code: 'SOURCE_NOT_FOUND' };
      if (!safeSource(item)) return { status: 'error', code: 'SOURCE_OPEN_FAILED' };
      try { await openUrl(item.url); return { status: 'opened' }; } catch { return { status: 'error', code: 'SOURCE_OPEN_FAILED' }; }
    },
  };
}
export const content = createPlaceContent(bundled);
