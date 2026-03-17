// Riftcodex API - Free, no key required
// https://api.riftcodex.com/cards

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL    = 'https://api.riftcodex.com';
const CACHE_KEY   = 'riftbound_cards_cache_v3'; // bumped when card shape changed
const CACHE_TTL   = 24 * 60 * 60 * 1000; // 24 hours in ms

// In-memory cache for current session (avoids re-parsing AsyncStorage every call)
let memoryCache = null;

const loadCacheFromStorage = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { cards, timestamp } = JSON.parse(raw);
    const age = Date.now() - timestamp;
    if (age > CACHE_TTL) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cards;
  } catch { return null; }
};

const saveCacheToStorage = async (cards) => {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
      cards,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('Card cache save failed:', e);
  }
};

const fetchAllFromAPI = async () => {
  let allItems = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await fetch(`${BASE_URL}/cards?page=${page}&size=100`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    allItems = [...allItems, ...(data.items || [])];
    totalPages = data.pages || 1;
    page++;
  } while (page <= totalPages);

  return allItems.map(card => ({
    id:               card.id,
    name:             card.name,
    tags:             card.tags || [],
    type:             card.classification?.type || '',
    domain:           card.classification?.domain?.[0] || 'Colorless',
    domains:          card.classification?.domain || ['Colorless'],
    rarity:           card.classification?.rarity || '',
    set:              card.set?.id || card.set?.set_id || (card.public_code ? card.public_code.split('-')[0] : '') || '',
    set_label:        card.set?.label || card.set?.id || card.set?.set_id || '',
    collector_number: card.collector_number ?? null,
    public_code:      card.public_code || '',
    metadata: {
      alternate_art: card.metadata?.alternate_art ?? false,
      overnumbered:  card.metadata?.overnumbered  ?? false,
      signature:     card.metadata?.signature      ?? false,
    },
    stats: {
      cost:  card.attributes?.energy ?? undefined,
      power: card.attributes?.power  ?? undefined,
      might: card.attributes?.might  ?? undefined,
    },
    rules:      [card.text?.plain || ''],
    art: {
      thumbnailUrl: card.media?.image_url || null,
      fullUrl:      card.media?.image_url || null,
      artist:       card.media?.artist    || '',
    },
    flavorText: '',
  }));
};

const getAllCards = async () => {
  // 1. In-memory (fastest — same session)
  if (memoryCache) return memoryCache;

  // 2. AsyncStorage (fast — persisted across sessions, valid 24h)
  const stored = await loadCacheFromStorage();
  if (stored) {
    memoryCache = stored;
    return memoryCache;
  }

  // 3. Fetch from API, then cache both ways
  const cards = await fetchAllFromAPI();
  memoryCache = cards;
  await saveCacheToStorage(cards); // fire-and-forget style is fine
  return memoryCache;
};

// Call this to force-refresh (e.g. pull-to-refresh)
export const clearCardCache = async () => {
  memoryCache = null;
  await AsyncStorage.removeItem(CACHE_KEY);
};

export const fetchCards = async ({ search = '', faction = '', type = '', rarity = '' } = {}) => {
  try {
    let cards = await getAllCards();
    if (search) {
      const q = search.toLowerCase();
      cards = cards.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    if (faction) cards = cards.filter(c => c.domains?.includes(faction));
    if (type)    cards = cards.filter(c => c.type === type);
    if (rarity)  cards = cards.filter(c => c.rarity === rarity);
    return { cards, total: cards.length };
  } catch (err) {
    console.error('fetchCards error:', err);
    return { cards: [], total: 0 };
  }
};

export const DOMAIN_COLORS = {
  Mind:      '#4A90D9',
  Fury:      '#E05252',
  Calm:      '#4CAF50',
  Order:     '#C9A84C',
  Chaos:     '#9B59B6',
  Body:      '#E8820C',
  Colorless: '#8A8A9A',
};

// Rarity values as returned by Riftcodex API
export const RARITIES = [
  { value: '',         label: 'All',      color: '#9A9AAA' },
  { value: 'Common',   label: 'Common',   color: '#F0F0F0' },
  { value: 'Uncommon', label: 'Uncommon', color: '#6BB8E8' },
  { value: 'Rare',     label: 'Rare',     color: '#9B59B6' },
  { value: 'Epic',     label: 'Epic',     color: '#E8820C' },
  { value: 'Showcase', label: 'Showcase', color: '#C9A84C' },
  { value: 'Signed',   label: 'Signed',   color: '#C0C8D8' },
  { value: 'Promo',    label: 'Promo',    color: '#E84393' },
];
