import { loadStore, saveStore } from './pet-store';
export function petDiet(pet) {
  return { brand: pet.food_brand || pet.diet?.brand || '', product: pet.food_product || pet.diet?.product || '' };
}
// Dates describe when this device observed the change, not the start of feeding.
export function rememberDiet(pet) {
  if (!pet?.id) return;
  const store = loadStore();
  const snapshots = { ...(store.dietSnapshots || {}) };
  const history = { ...(store.dietHistory || {}) };
  const next = petDiet(pet),
    previous = snapshots[pet.id];
  if (previous && previous.brand === next.brand && previous.product === next.product) return;
  const now = new Date().toISOString();
  if (previous && (previous.brand || previous.product)) {
    history[pet.id] = [
      { ...previous, archivedAt: now, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ...(history[pet.id] || []),
    ];
  }
  snapshots[pet.id] = { ...next, observedAt: now };
  saveStore({ dietSnapshots: snapshots, dietHistory: history });
}
export function dietHistory(petId) {
  return loadStore().dietHistory?.[petId] || [];
}
