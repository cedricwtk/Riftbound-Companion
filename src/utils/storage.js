import AsyncStorage from '@react-native-async-storage/async-storage';

const DECKS_KEY      = 'riftbound_decks_v1';
const SETTINGS_KEY   = 'riftbound_settings';
const COLLECTION_KEY = 'riftbound_collection';

// ── Decks ─────────────────────────────────────────────────────────────────────
export const getDecks = async () => {
  try {
    const raw = await AsyncStorage.getItem(DECKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveDeck = async (deck) => {
  try {
    const decks = await getDecks();
    const idx = decks.findIndex(d => d.id === deck.id);
    if (idx >= 0) decks[idx] = deck;
    else decks.unshift(deck);
    await AsyncStorage.setItem(DECKS_KEY, JSON.stringify(decks));
    return true;
  } catch { return false; }
};

export const deleteDeck = async (deckId) => {
  try {
    const decks = await getDecks();
    const filtered = decks.filter(d => d.id !== deckId);
    await AsyncStorage.setItem(DECKS_KEY, JSON.stringify(filtered));
    return true;
  } catch { return false; }
};

// ── Collection (Masterset) ────────────────────────────────────────────────────
export const getCollection = async () => {
  try {
    const raw = await AsyncStorage.getItem(COLLECTION_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

export const saveCollection = async (collectionSet) => {
  try {
    await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify([...collectionSet]));
    return true;
  } catch { return false; }
};

export const toggleCollectionCard = async (cardId) => {
  const collection = await getCollection();
  if (collection.has(cardId)) collection.delete(cardId);
  else collection.add(cardId);
  await saveCollection(collection);
  return collection;
};

// ── Premium ───────────────────────────────────────────────────────────────────
// TODO: Re-enable freemium gating once download target is reached.
// For now, all users get premium features.
const PREMIUM_KEY = 'riftbound_premium';

export const isPremium = async () => {
  return true;
};

export const setPremium = async (value) => {
  try {
    await AsyncStorage.setItem(PREMIUM_KEY, value ? 'true' : 'false');
    return true;
  } catch { return false; }
};

// ── Settings ──────────────────────────────────────────────────────────────────
// Shape: { eTransferEmail: string, displayName: string, includeETransfer: boolean }
export const getSettings = async () => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

export const saveSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch { return false; }
};
