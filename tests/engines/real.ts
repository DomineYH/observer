// The real 지형 원천 in this browser, through the app's own path: loadTerrain fetches, unpacks and hashes, and its boot
// screen shows the 받는 중 line or the 오류 화면. On success the identity is printed for the spec.
import { terrainHash } from '@sim';
import { loadTerrain } from '@app/backend';
import { bootScreen } from '@app/boot';

const root = document.getElementById('root')!;
const t = await loadTerrain('real', 0, bootScreen(root));
const out = document.createElement('pre');
out.id = 'terrain';
out.textContent = JSON.stringify({ id: t.id, version: t.version, hash: terrainHash(t) });
root.replaceChildren(out);
