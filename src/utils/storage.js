import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  DECKS: 'riftbound_decks',
  GAME_HISTORY: 'riftbound_game_history',
  SETTINGS: 'riftbound_settings',
};

// --- Decks ---
export const getDecks = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DECKS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveDeck = async (deck) => {
  try {
    const decks = await getDecks();
    const idx = decks.findIndex(d => d.id === deck.id);
    if (idx >= 0) decks[idx] = deck;
    else decks.push(deck);
    await AsyncStorage.setItem(KEYS.DECKS, JSON.stringify(decks));
    return true;
  } catch { return false; }
};

export const deleteDeck = async (deckId) => {
  try {
    const decks = await getDecks();
    const filtered = decks.filter(d => d.id !== deckId);
    await AsyncStorage.setItem(KEYS.DECKS, JSON.stringify(filtered));
    return true;
  } catch { return false; }
};

// --- Game History ---
export const getGameHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GAME_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveGame = async (game) => {
  try {
    const history = await getGameHistory();
    history.unshift(game); // newest first
    const trimmed = history.slice(0, 50); // keep last 50
    await AsyncStorage.setItem(KEYS.GAME_HISTORY, JSON.stringify(trimmed));
    return true;
  } catch { return false; }
};

// --- Settings ---
export const getSettings = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : { defaultWinPoints: 8 };
  } catch { return { defaultWinPoints: 8 }; }
};

export const saveSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch { return false; }
};
