// Riftcodex API - Free, no key required
// https://api.riftcodex.com/cards

const BASE_URL = 'https://api.riftcodex.com';

// Cache all cards after first fetch to avoid repeated requests
let cachedCards = null;

const getAllCards = async () => {
  if (cachedCards) return cachedCards;

  let allItems = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await fetch(`${BASE_URL}/cards?page=${page}&size=100`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const items = data.items || [];
    allItems = [...allItems, ...items];
    totalPages = data.pages || 1;
    page++;
  } while (page <= totalPages);

  cachedCards = allItems.map(card => ({
    id: card.id,
    name: card.name,
    type: card.classification?.type || '',
    domain: card.classification?.domain?.[0] || 'Colorless',
    domains: card.classification?.domain || ['Colorless'],
    rarity: card.classification?.rarity || '',
    set: card.set?.set_id || '',
    stats: {
      cost:  card.attributes?.energy ?? undefined,
      power: card.attributes?.power  ?? undefined,
      might: card.attributes?.might  ?? undefined,
    },
    rules: [card.text?.plain || ''],
    art: {
      thumbnailUrl: card.media?.image_url || null,
      fullUrl:      card.media?.image_url || null,
      artist:       card.media?.artist    || '',
    },
    flavorText: '',
  }));
  return cachedCards;
};

export const fetchCards = async ({ search = '', faction = '', type = '' } = {}) => {
  try {
    let cards = await getAllCards();

    if (search) cards = cards.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
    if (faction) cards = cards.filter(c => c.domains?.includes(faction));
    if (type) cards = cards.filter(c => c.type === type);

    return { cards, total: cards.length };
  } catch (err) {
    console.error('fetchCards error:', err);
    return { cards: [], total: 0 };
  }
};

export const DOMAIN_COLORS = {
  Mind:      '#4A90D9',  // blue
  Fury:      '#E05252',  // red
  Calm:      '#4CAF50',  // green
  Order:     '#C9A84C',  // yellow
  Chaos:     '#9B59B6',  // purple
  Body:      '#E8820C',  // orange
  Colorless: '#8A8A9A',  // grey (Battlefields)
};