import AsyncStorage from '@react-native-async-storage/async-storage';

const DECKS_KEY    = 'riftbound_decks_v1';
const SETTINGS_KEY = 'riftbound_settings';

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

// ── Premium ───────────────────────────────────────────────────────────────────
const PREMIUM_KEY = 'riftbound_premium';

export const isPremium = async () => {
  try {
    const val = await AsyncStorage.getItem(PREMIUM_KEY);
    return val === 'true';
  } catch { return false; }
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
