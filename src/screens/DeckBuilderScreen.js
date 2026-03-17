import React, { useState, useEffect, useCallback, useRef } from 'react';

import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, Share, Image, ScrollView
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { getDecks, saveDeck, deleteDeck, isPremium } from '../utils/storage';
import PremiumGate from '../components/PremiumGate';
import DeckStatsModal from '../components/DeckStatsModal';
import CardsScreen from './CardsScreen';
import { DOMAIN_COLORS, RARITIES, fetchCards } from '../utils/api';

// ─────────────────────────────────────────────────────────────────────────────
// Rules
// ─────────────────────────────────────────────────────────────────────────────
const MAX_MAIN        = 40;   // champion counts toward this
const MAX_SIDEBOARD   = 8;    // 48 total pool − 40 main
const MAX_POOL        = 48;   // max total cards across main + sideboard
const MAX_RUNES       = 12;
const MAX_BATTLEFIELDS = 3;
const MAX_COPIES      = 3;    // across the whole pool (main + sideboard combined)

// A card is "Unique" if its rules text contains [Unique]
const isUnique = (card) => card.rules?.some(r => r.includes('[Unique]'));

// ─────────────────────────────────────────────────────────────────────────────
// Slot accessors
// ─────────────────────────────────────────────────────────────────────────────
const getLegend       = d => d.slots?.legend       || null;
const getChampion     = d => d.slots?.champion     || null;
const getBFs          = d => d.slots?.battlefields || [];
const getRunes        = d => d.slots?.runes        || [];
const getMain         = d => d.slots?.main         || [];
const getSideboard    = d => d.slots?.sideboard    || [];

const getLegendDomains = d => {
  const l = getLegend(d);
  if (!l) return [];
  return l.domains?.length ? l.domains : (l.domain ? [l.domain] : []);
};

// ─────────────────────────────────────────────────────────────────────────────
// Small shared pieces
// ─────────────────────────────────────────────────────────────────────────────
const DomainDot = ({ domain, size = 8 }) => (
  <View style={{
    width: size, height: size, borderRadius: size / 2,
    backgroundColor: DOMAIN_COLORS[domain] || COLORS.textMuted,
  }} />
);

const DomainTag = ({ domain }) => (
  <View style={styles.domainTag}>
    <DomainDot domain={domain} />
    <Text style={[styles.domainTagText, { color: DOMAIN_COLORS[domain] || COLORS.textMuted }]}>{domain}</Text>
  </View>
);

const SectionHead = ({ title, filled, max }) => (
  <View style={styles.sectionHead}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={[styles.sectionCount, filled >= max && styles.sectionCountFull]}>
      {filled} / {max}
    </Text>
  </View>
);

// Thumbnail with fallback icon
const Thumb = ({ card, width = 52, height = 72 }) => (
  card?.art?.thumbnailUrl
    ? <Image source={{ uri: card.art.thumbnailUrl }} style={{ width, height, borderRadius: RADIUS.sm }} resizeMode="cover" />
    : <View style={[styles.thumbPlaceholder, { width, height, borderRadius: RADIUS.sm }]}>
        <Ionicons name="image-outline" size={width * 0.35} color={COLORS.textMuted} />
      </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// SlotRow — for Legend, Champion, Battlefield (unique 1-card slots)
// ─────────────────────────────────────────────────────────────────────────────
const SlotRow = ({ card, emptyLabel, onChoose, onRemove, showDomains }) => {
  if (!card) {
    return (
      <TouchableOpacity style={styles.emptySlot} onPress={onChoose} activeOpacity={0.8}>
        <View style={styles.emptySlotThumb}>
          <Ionicons name="add" size={22} color={COLORS.textMuted} />
        </View>
        <Text style={styles.emptySlotLabel}>{emptyLabel}</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  }
  const primaryDomain = card.domain;
  const accentColor   = DOMAIN_COLORS[primaryDomain] || COLORS.border;
  return (
    <View style={[styles.slotRow, { borderLeftColor: accentColor }]}>
      <Thumb card={card} />
      <View style={styles.slotInfo}>
        <Text style={styles.slotName} numberOfLines={1}>{card.name}</Text>
        <View style={styles.slotMetaRow}>
          {showDomains
            ? (card.domains || [card.domain]).map(d => <DomainTag key={d} domain={d} />)
            : <Text style={[styles.slotSub, { color: accentColor }]}>{card.domain} · {card.type}</Text>
          }
        </View>
        {card.rules?.[0] && (
          <Text style={styles.slotRule} numberOfLines={2}>{card.rules[0]}</Text>
        )}
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={20} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CardRow — for runes and main deck (with +/- count controls)
// ─────────────────────────────────────────────────────────────────────────────
const CardRow = ({ card, onAdd, onRemove }) => {
  const domainColor = DOMAIN_COLORS[card.domain] || COLORS.textMuted;
  const rarityColor = RARITIES.find(r => r.value === card.rarity)?.color || COLORS.textMuted;
  const atMax = card.count >= MAX_COPIES;
  return (
    <View style={styles.cardRow}>
      <Thumb card={card} width={38} height={52} />
      <View style={styles.cardRowInfo}>
        <Text style={styles.cardRowName} numberOfLines={1}>{card.name}</Text>
        <View style={styles.cardRowMeta}>
          <DomainDot domain={card.domain} />
          <Text style={[styles.cardRowDomain, { color: domainColor }]}>{card.domain}</Text>
          <Text style={[styles.cardRowRarity, { color: rarityColor }]}>{card.rarity}</Text>
        </View>
      </View>
      <View style={styles.countCtrl}>
        <TouchableOpacity style={styles.countBtn} onPress={() => onRemove(card)}>
          <Ionicons name="remove" size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.countNum, atMax && { color: COLORS.win }]}>{card.count}</Text>
        <TouchableOpacity
          style={[styles.countBtn, atMax && { opacity: 0.3 }]}
          onPress={() => onAdd(card)}
          disabled={atMax}
        >
          <Ionicons name="add" size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Deck list card — shown in the overview list
// ─────────────────────────────────────────────────────────────────────────────
const DeckCard = ({ deck, onPress, onDelete }) => {
  const legend   = getLegend(deck);
  const domains  = getLegendDomains(deck);
  const mainCnt  = getMain(deck).reduce((s, c) => s + c.count, 0) + (getChampion(deck) ? 1 : 0);
  const runeCnt  = getRunes(deck).reduce((s, r) => s + r.count, 0);
  const bfCnt    = getBFs(deck).length;
  const sideCnt  = getSideboard(deck).reduce((s, c) => s + c.count, 0);

  return (
    <TouchableOpacity style={styles.deckCard} onPress={() => onPress(deck)} activeOpacity={0.85}>
      {/* Legend art as left panel */}
      <View style={styles.deckCardThumbWrap}>
        <Thumb card={legend} width={76} height={104} />
        {/* domain pips */}
        {domains.length > 0 && (
          <View style={styles.deckCardPips}>
            {domains.map(d => <DomainDot key={d} domain={d} size={7} />)}
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.deckCardBody}>
        <Text style={styles.deckCardName}>{deck.name}</Text>
        <Text style={styles.deckCardLegend} numberOfLines={1}>
          {legend ? legend.name : 'No Legend selected'}
        </Text>
        {domains.length > 0 && (
          <View style={styles.deckCardDomains}>
            {domains.map(d => <DomainTag key={d} domain={d} />)}
          </View>
        )}
        {/* Progress pills */}
        <View style={styles.deckCardPills}>
          <Pill label="BF"    val={bfCnt}   max={MAX_BATTLEFIELDS} />
          <Pill label="Runes" val={runeCnt} max={MAX_RUNES} />
          <Pill label="Deck"  val={mainCnt} max={MAX_MAIN} />
          <Pill label="Side"  val={sideCnt} max={MAX_SIDEBOARD} />
        </View>
      </View>

      <TouchableOpacity style={styles.deckCardDelete} onPress={() => onDelete(deck)}>
        <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const Pill = ({ label, val, max }) => {
  const full = val >= max;
  return (
    <View style={[styles.pill, full && styles.pillFull]}>
      <Text style={[styles.pillText, full && styles.pillTextFull]}>{label} {val}/{max}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function DeckBuilderScreen({ onPremiumChange }) {
  const insets = useSafeAreaInsets();
  const [decks, setDecks]               = useState([]);
  const [activeDeck, setActiveDeck]     = useState(null);
  const [newModal, setNewModal]         = useState(false);
  const [newName, setNewName]           = useState('');
  const [premiumUser, setPremiumUser]   = useState(false);
  const [showGate, setShowGate]         = useState(false);
  const [showStats, setShowStats]       = useState(false);

  const FREE_DECK_LIMIT = 3;
  // browseMode: null | 'legend' | 'champion' | 'battlefield' | 'main' | 'sideboard'
  const [browseMode, setBrowseMode]     = useState(null);

  const scrollRef = useRef(null);

  useEffect(() => { load(); }, []);

  // Scroll to top whenever we return from browse mode
  useEffect(() => {
    if (!browseMode) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [browseMode]);

  const load = async () => {
    const [d, prem] = await Promise.all([getDecks(), isPremium()]);
    setDecks(d);
    setPremiumUser(prem);
  };

  // ── Create deck ─────────────────────────────────────────────────────────────
  const createDeck = async () => {
    if (!newName.trim()) return;
    const deck = {
      id: Date.now().toString(),
      name: newName.trim(),
      createdAt: new Date().toISOString(),
      slots: { legend: null, champion: null, battlefields: [], runes: [], main: [], sideboard: [] },
    };
    await saveDeck(deck);
    await load();
    setActiveDeck(deck);
    setNewModal(false);
    setNewName('');
  };

  // ── Delete deck ─────────────────────────────────────────────────────────────
  const confirmDelete = (deck) => Alert.alert(
    'Delete Deck', `Delete "${deck.name}"?`,
    [{ text: 'Cancel', style: 'cancel' },
     { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteDeck(deck.id);
        if (activeDeck?.id === deck.id) setActiveDeck(null);
        await load();
     }}]
  );

  // ── Persist helper ──────────────────────────────────────────────────────────
  const persist = useCallback((updater) => {
    setActiveDeck(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      saveDeck(next).then(load);
      return next;
    });
  }, []);

  // ── Add card handler ────────────────────────────────────────────────────────
  const handleAdd = useCallback((card) => {
    if (!activeDeck || !browseMode) return;
    const legendDomains = getLegendDomains(activeDeck);

    // Domain check helper (not for legend/battlefield selection)
    const domainOk = () => {
      if (!legendDomains.length) return true;
      return legendDomains.includes(card.domain);
    };

    if (browseMode === 'legend') {
      const current = getLegend(activeDeck);
      const apply = () => persist(d => ({
        ...d, slots: {
          ...d.slots, legend: card,
          // Clear domain-dependent slots when legend changes
          ...(current && current.id !== card.id
            ? { champion: null, runes: [], main: [] }
            : {}),
        },
      }));
      if (current && current.id !== card.id) {
        Alert.alert(
          'Replace Legend?',
          `Changing legend from "${current.name}" to "${card.name}" will clear your champion, runes, and main deck (domain will change).`,
          [{ text: 'Cancel', style: 'cancel' },
           { text: 'Replace & Clear', style: 'destructive', onPress: apply }]
        );
      } else { apply(); }
      setBrowseMode(null);
      return;
    }

    if (browseMode === 'champion') {
      if (card.type !== 'Unit') {
        Alert.alert('Wrong Type', 'Only Unit cards can be set as champion.');
        return;
      }
      if (!domainOk()) {
        Alert.alert('Wrong Domain', `"${card.name}" doesn't belong to your legend's domains (${legendDomains.join(', ')}).`);
        return;
      }
      const legendTags = getLegend(activeDeck)?.tags || [];
      if (legendTags.length > 0 && !card.tags?.some(t => legendTags.includes(t))) {
        Alert.alert('Wrong Champion', `"${card.name}" doesn't match your legend's champion.`);
        return;
      }
      persist(d => ({ ...d, slots: { ...d.slots, champion: card } }));
      setBrowseMode(null);
      return;
    }

    if (browseMode === 'battlefield') {
      if (card.type !== 'Battlefield') {
        Alert.alert('Wrong Type', 'Only Battlefield cards go in battlefield slots.');
        return;
      }
      const bfs = getBFs(activeDeck);
      if (bfs.find(b => b.id === card.id)) {
        Alert.alert('Already Added', 'That Battlefield is already in your deck.');
        return;
      }
      if (bfs.length >= MAX_BATTLEFIELDS) {
        Alert.alert('Full', `Max ${MAX_BATTLEFIELDS} battlefields.`);
        setBrowseMode(null);
        return;
      }
      persist(d => ({ ...d, slots: { ...d.slots, battlefields: [...getBFs(d), card] } }));
      // Stay in gallery so user can pick remaining battlefields
      return;
    }

    if (browseMode === 'rune') {
      if (!domainOk()) {
        Alert.alert('Wrong Domain', `Runes must belong to your legend's domains: ${legendDomains.join(', ')}.`);
        return;
      }
      persist(d => {
        const runes = [...getRunes(d)];
        const idx = runes.findIndex(r => r.id === card.id);
        const total = runes.reduce((s, r) => s + r.count, 0);
        if (idx >= 0) {
          if (runes[idx].count >= MAX_COPIES) { Alert.alert('Max Copies', `Max ${MAX_COPIES} copies of the same rune.`); return d; }
          if (total >= MAX_RUNES) { Alert.alert('Runes Full', `Max ${MAX_RUNES} runes total.`); return d; }
          runes[idx] = { ...runes[idx], count: runes[idx].count + 1 };
        } else {
          if (total >= MAX_RUNES) { Alert.alert('Runes Full', `Max ${MAX_RUNES} runes total.`); return d; }
          runes.push({ ...card, count: 1 });
        }
        return { ...d, slots: { ...d.slots, runes } };
      });
      return;
    }

    if (browseMode === 'main') {
      if (['Battlefield', 'Legend', 'Rune'].includes(card.type)) {
        Alert.alert('Wrong Section', `${card.type} cards go in their own slots, not the main deck.`);
        return;
      }
      if (!domainOk()) {
        Alert.alert('Wrong Domain', `"${card.name}" doesn't belong to your legend's domains (${legendDomains.join(', ')}).`);
        return;
      }
      const lt = getLegend(activeDeck)?.tags || [];
      if (lt.length > 0 && card.tags?.length > 0
          && card.type !== 'Unit' && card.type !== 'Champion'
          && !card.tags.some(t => lt.includes(t))
          && !(card.type === 'Gear' && !card.tags.some(t => t !== 'Equipment'))) {
        Alert.alert('Wrong Champion', `"${card.name}" belongs to a different champion.`);
        return;
      }
      persist(d => {
        const main      = [...getMain(d)];
        const side      = getSideboard(d);
        const idx       = main.findIndex(c => c.name === card.name);
        const champCount = getChampion(d) ? 1 : 0;
        const mainTotal = main.reduce((s, c) => s + c.count, 0) + champCount;
        // Count ALL copies of this name across main + sideboard
        const mainNameCount = idx >= 0 ? main[idx].count : 0;
        const sideNameCount = side.filter(c => c.name === card.name).reduce((s, c) => s + c.count, 0);
        const copyLimit = isUnique(card) ? 1 : MAX_COPIES;
        if (mainNameCount + sideNameCount >= copyLimit) { Alert.alert(isUnique(card) ? 'Unique Card' : 'Max Copies', isUnique(card) ? `"${card.name}" is Unique — only 1 copy allowed in your deck.` : `Max ${MAX_COPIES} copies of "${card.name}" across main deck + sideboard.`); return d; }
        if (mainTotal >= MAX_MAIN) { Alert.alert('Deck Full', `Max ${MAX_MAIN} cards in main deck.`); return d; }
        if (idx >= 0) {
          main[idx] = { ...main[idx], count: main[idx].count + 1 };
        } else {
          main.push({ ...card, count: 1 });
        }
        return { ...d, slots: { ...d.slots, main } };
      });
      // Stay in gallery — user uses back button when done
      return;
    }

    if (browseMode === 'sideboard') {
      if (['Battlefield', 'Legend', 'Rune'].includes(card.type)) {
        Alert.alert('Wrong Section', `${card.type} cards go in their own slots, not the sideboard.`);
        return;
      }
      if (!domainOk()) {
        Alert.alert('Wrong Domain', `"${card.name}" doesn't belong to your legend's domains (${legendDomains.join(', ')}).`);
        return;
      }
      const lt = getLegend(activeDeck)?.tags || [];
      if (lt.length > 0 && card.tags?.length > 0
          && card.type !== 'Unit' && card.type !== 'Champion'
          && !card.tags.some(t => lt.includes(t))
          && !(card.type === 'Gear' && !card.tags.some(t => t !== 'Equipment'))) {
        Alert.alert('Wrong Champion', `"${card.name}" belongs to a different champion.`);
        return;
      }
      persist(d => {
        const side      = [...getSideboard(d)];
        const main      = getMain(d);
        const idx       = side.findIndex(c => c.name === card.name);
        const sideTotal = side.reduce((s, c) => s + c.count, 0);
        // Count ALL copies of this name across main + sideboard
        const sideNameCount = idx >= 0 ? side[idx].count : 0;
        const mainNameCount = main.filter(c => c.name === card.name).reduce((s, c) => s + c.count, 0);
        const copyLimit = isUnique(card) ? 1 : MAX_COPIES;
        if (sideNameCount + mainNameCount >= copyLimit) { Alert.alert(isUnique(card) ? 'Unique Card' : 'Max Copies', isUnique(card) ? `"${card.name}" is Unique — only 1 copy allowed in your deck.` : `Max ${MAX_COPIES} copies of "${card.name}" across main deck + sideboard.`); return d; }
        if (sideTotal >= MAX_SIDEBOARD) { Alert.alert('Sideboard Full', `Max ${MAX_SIDEBOARD} cards in sideboard.`); return d; }
        if (idx >= 0) {
          side[idx] = { ...side[idx], count: side[idx].count + 1 };
        } else {
          side.push({ ...card, count: 1 });
        }
        return { ...d, slots: { ...d.slots, sideboard: side } };
      });
      // Stay in gallery
      return;
    }
  }, [activeDeck, browseMode, persist]);

  // ── Remove helpers ──────────────────────────────────────────────────────────
  // Used both by deck view CardRows AND the gallery counter
  const handleGalleryRemove = useCallback((card) => {
    if (!activeDeck || !browseMode) return;
    if (browseMode === 'battlefield') { remove('battlefield', card.id); return; }
    if (browseMode === 'main')        { remove('main', card.id);        return; }
    if (browseMode === 'sideboard')   { remove('sideboard', card.id);   return; }
  }, [activeDeck, browseMode]);
  const remove = (section, id) => persist(d => {
    const s = { ...d.slots };
    if (section === 'legend')      s.legend = null;
    if (section === 'champion')    s.champion = null;
    if (section === 'battlefield') s.battlefields = s.battlefields.filter(b => b.id !== id);
    if (section === 'rune')        s.runes = s.runes
      .map(r => r.id === id ? { ...r, count: r.count - 1 } : r).filter(r => r.count > 0);
    if (section === 'main')        s.main = s.main
      .map(c => c.id === id ? { ...c, count: c.count - 1 } : c).filter(c => c.count > 0);
    if (section === 'sideboard')   s.sideboard = (s.sideboard || [])
      .map(c => c.id === id ? { ...c, count: c.count - 1 } : c).filter(c => c.count > 0);
    return { ...d, slots: s };
  });

  const addMore = (section, id) => persist(d => {
    if (section === 'rune') {
      const runes = d.slots.runes.map(r =>
        r.id === id ? (r.count < MAX_COPIES && getRunes(d).reduce((s,r)=>s+r.count,0) < MAX_RUNES
          ? { ...r, count: r.count + 1 } : r) : r
      );
      return { ...d, slots: { ...d.slots, runes } };
    }
    if (section === 'main') {
      const champCount = getChampion(d) ? 1 : 0;
      const mainTotal  = getMain(d).reduce((s,c)=>s+c.count,0) + champCount;
      const card       = getMain(d).find(c => c.id === id);
      if (!card) return d;
      const sideNameCount = getSideboard(d).filter(c => c.name === card.name).reduce((s,c)=>s+c.count,0);
      const copyLimit = isUnique(card) ? 1 : MAX_COPIES;
      const main = d.slots.main.map(c => {
        if (c.id !== id) return c;
        if (c.count + sideNameCount >= copyLimit || mainTotal >= MAX_MAIN) return c;
        return { ...c, count: c.count + 1 };
      });
      return { ...d, slots: { ...d.slots, main } };
    }
    if (section === 'sideboard') {
      const sideTotal  = getSideboard(d).reduce((s,c)=>s+c.count,0);
      const card       = getSideboard(d).find(c => c.id === id);
      if (!card) return d;
      const mainNameCount = getMain(d).filter(c => c.name === card.name).reduce((s,c)=>s+c.count,0);
      const copyLimit = isUnique(card) ? 1 : MAX_COPIES;
      const side = (d.slots.sideboard || []).map(c => {
        if (c.id !== id) return c;
        if (c.count + mainNameCount >= copyLimit || sideTotal >= MAX_SIDEBOARD) return c;
        return { ...c, count: c.count + 1 };
      });
      return { ...d, slots: { ...d.slots, sideboard: side } };
    }
    return d;
  });

  // ── Share ───────────────────────────────────────────────────────────────────
  const share = () => {
    if (!activeDeck) return;
    const legend    = getLegend(activeDeck);
    const champion  = getChampion(activeDeck);
    const bfs       = getBFs(activeDeck);
    const runes     = getRunes(activeDeck);
    const main      = getMain(activeDeck);
    const side      = getSideboard(activeDeck);

    // Sort alphabetically by name
    const sorted = arr => [...arr].sort((a,b) => a.name.localeCompare(b.name));

    const lines = [
      'Legend:',
      legend ? `1 ${legend.name}` : '(none)',
      'Champion:',
      champion ? `1 ${champion.name}` : '(none)',
      'Battlefields:',
      ...bfs.map(b => `1 ${b.name}`),
      'Main Deck:',
      ...sorted(main).map(c => `${c.count} ${c.name}`),
      'Rune Pool:',
      ...sorted(runes).map(r => `${r.count} ${r.domain} Rune`),
      ...(side.length > 0 ? [
        'Sideboard:',
        ...sorted(side).map(c => `${c.count} ${c.name}`),
      ] : []),
    ];
    Share.share({ message: lines.join('\n'), title: activeDeck.name });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Browse overlay
  // ─────────────────────────────────────────────────────────────────────────
  if (browseMode && activeDeck) {
    const legendDomains = getLegendDomains(activeDeck);
    const bfs  = getBFs(activeDeck);
    const main = getMain(activeDeck);
    const side = getSideboard(activeDeck);

    const modeLabel = {
      legend: 'Choose Legend', champion: 'Choose Champion',
      battlefield: 'Choose Battlefields', main: 'Main Deck', sideboard: 'Sideboard',
    }[browseMode];

    const hint = browseMode === 'battlefield'
      ? `Battlefields only · ${bfs.length}/${MAX_BATTLEFIELDS} chosen`
      : legendDomains.length
        ? `Only ${legendDomains.join(' + ')} cards`
        : 'Set a Legend first to filter by domain';

    // Live count shown in header badge
    const liveCount = browseMode === 'battlefield' ? bfs.length
      : browseMode === 'main' ? (main.reduce((s,c)=>s+c.count,0) + (getChampion(activeDeck) ? 1 : 0))
      : browseMode === 'sideboard' ? side.reduce((s,c)=>s+c.count,0)
      : null;
    const liveMax = browseMode === 'battlefield' ? MAX_BATTLEFIELDS
      : browseMode === 'main' ? MAX_MAIN
      : browseMode === 'sideboard' ? MAX_SIDEBOARD
      : null;

    // Build deckCounts keyed by card NAME (not id) — aggregates all versions
    const isCounterMode = ['battlefield', 'main', 'sideboard'].includes(browseMode);
    let deckCounts = null;
    if (browseMode === 'battlefield') {
      deckCounts = {};
      bfs.forEach(b => { deckCounts[b.name] = 1; });
    } else if (browseMode === 'main') {
      // Show total pool copies (main + side) so the cap is enforced visually
      deckCounts = {};
      main.forEach(c => { deckCounts[c.name] = (deckCounts[c.name] || 0) + c.count; });
      side.forEach(c => { deckCounts[c.name] = (deckCounts[c.name] || 0) + c.count; });
    } else if (browseMode === 'sideboard') {
      deckCounts = {};
      side.forEach(c => { deckCounts[c.name] = (deckCounts[c.name] || 0) + c.count; });
      main.forEach(c => { deckCounts[c.name] = (deckCounts[c.name] || 0) + c.count; });
    }

    const getEffectiveCounts = () => deckCounts;

    // Props to pass to CardsScreen
    const csProps = {};
    if (browseMode === 'legend')    { csProps.forcedType = 'Legend'; csProps.maxCount = 1; }
    if (browseMode === 'battlefield') { csProps.forcedType = 'Battlefield'; csProps.maxCount = 1; }
    if (browseMode === 'champion') {
      csProps.forcedDomains = legendDomains;
      csProps.forcedType    = 'Unit';
      csProps.forcedTags    = getLegend(activeDeck)?.tags || [];
    }
    if (browseMode === 'main' || browseMode === 'sideboard') {
      csProps.forcedDomains   = legendDomains;
      csProps.hideLegend      = true;
      csProps.hideBattlefield = true;
      csProps.legendTags      = getLegend(activeDeck)?.tags || [];
    }

    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={styles.browseBar} edges={['top', 'left', 'right']}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setBrowseMode(null)}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.browseTitle}>{modeLabel}</Text>
            <Text style={styles.browseHint}>{hint}</Text>
          </View>
          {/* Live count badge */}
          {liveCount !== null && (
            <View style={[styles.liveBadge, liveCount >= liveMax && styles.liveBadgeFull]}>
              <Text style={[styles.liveBadgeText, liveCount >= liveMax && styles.liveBadgeTextFull]}>
                {liveCount}/{liveMax}
              </Text>
            </View>
          )}
          {/* Done button for counter modes */}
          {isCounterMode && (
            <TouchableOpacity style={styles.browseDoneBtn} onPress={() => setBrowseMode(null)}>
              <Text style={styles.browseDoneBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
        <CardsScreen
          onAddToDeck={handleAdd}
          onRemoveFromDeck={isCounterMode ? handleGalleryRemove : undefined}
          deckCounts={isCounterMode ? getEffectiveCounts() : undefined}
          {...csProps}
        />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Deck list
  // ─────────────────────────────────────────────────────────────────────────
  if (!activeDeck) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.screenTitle}>MY DECKS</Text>
            {!premiumUser && (
              <Text style={styles.deckSlotsLabel}>
                {decks.length} / {FREE_DECK_LIMIT} slots used
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={() => {
              if (!premiumUser && decks.length >= FREE_DECK_LIMIT) { setShowGate(true); return; }
              setNewModal(true);
            }}>
            <Ionicons name="add" size={18} color={COLORS.textPrimary} />
            <Text style={styles.newBtnText}>New Deck</Text>
          </TouchableOpacity>
        </View>

        {decks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={52} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No Decks Yet</Text>
            <Text style={styles.emptySub}>Create your first deck to get started</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setNewModal(true)}>
              <Text style={styles.emptyBtnText}>Create Deck</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={decks}
            keyExtractor={d => d.id}
            contentContainerStyle={{ padding: SPACING.md, gap: SPACING.md, paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <DeckCard deck={item} onPress={setActiveDeck} onDelete={confirmDelete} />
            )}
          />
        )}

        {/* New Deck modal */}
        <Modal visible={newModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>NEW DECK</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Deck name..."
                placeholderTextColor={COLORS.textMuted}
                value={newName}
                onChangeText={setNewName}
                autoFocus maxLength={40}
              />
              <View style={styles.modalRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setNewModal(false); setNewName(''); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, !newName.trim() && { opacity: 0.4 }]}
                  onPress={createDeck} disabled={!newName.trim()}
                >
                  <Text style={styles.confirmBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <PremiumGate
          visible={showGate}
          onClose={() => setShowGate(false)}
          onUnlock={() => { setPremiumUser(true); setShowGate(false); onPremiumChange?.(); }}
          reason="Unlock unlimited deck slots with Premium"
        />
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Deck builder view
  // ─────────────────────────────────────────────────────────────────────────
  const legend      = getLegend(activeDeck);
  const champion    = getChampion(activeDeck);
  const bfs         = getBFs(activeDeck);
  const runes       = getRunes(activeDeck);
  const main        = getMain(activeDeck);
  const side        = getSideboard(activeDeck);
  const domains     = getLegendDomains(activeDeck);
  const runeCount   = runes.reduce((s, r) => s + r.count, 0);
  const champCount  = champion ? 1 : 0;
  const mainCount   = main.reduce((s, c) => s + c.count, 0) + champCount;
  const sideCount   = side.reduce((s, c) => s + c.count, 0);

  const needLegend = !legend;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.builderHeader}>
        <TouchableOpacity onPress={() => setActiveDeck(null)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.builderName} numberOfLines={1}>{activeDeck.name}</Text>
          {domains.length > 0 && (
            <View style={styles.builderDomains}>
              {domains.map(d => <DomainTag key={d} domain={d} />)}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            if (!premiumUser) { setShowGate(true); return; }
            setShowStats(true);
          }}
        >
          <Ionicons name="bar-chart-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={share}>
          <Ionicons name="share-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >

        {/* ── LEGEND ─────────────────────────────────────────────────────── */}
        <SectionHead title="LEGEND" filled={legend ? 1 : 0} max={1} />
        <SlotRow
          card={legend}
          emptyLabel="Choose your Legend"
          showDomains
          onChoose={() => setBrowseMode('legend')}
          onRemove={() => remove('legend', legend?.id)}
        />

        {/* ── CHAMPION ───────────────────────────────────────────────────── */}
        <SectionHead title="CHAMPION" filled={champion ? 1 : 0} max={1} />
        {needLegend
          ? <Text style={styles.lockedNote}>Set your Legend first</Text>
          : <SlotRow
              card={champion}
              emptyLabel="Choose a Champion"
              onChoose={() => setBrowseMode('champion')}
              onRemove={() => remove('champion', champion?.id)}
            />
        }

        {/* ── BATTLEFIELDS ───────────────────────────────────────────────── */}
        <SectionHead title="BATTLEFIELDS" filled={bfs.length} max={MAX_BATTLEFIELDS} />
        {bfs.map(bf => (
          <SlotRow
            key={bf.id}
            card={bf}
            emptyLabel=""
            onChoose={() => {}}
            onRemove={() => remove('battlefield', bf.id)}
          />
        ))}
        {bfs.length < MAX_BATTLEFIELDS && (
          <TouchableOpacity style={styles.emptySlot} onPress={() => setBrowseMode('battlefield')} activeOpacity={0.8}>
            <View style={styles.emptySlotThumb}>
              <Ionicons name="add" size={22} color={COLORS.textMuted} />
            </View>
            <Text style={styles.emptySlotLabel}>
              Add Battlefield ({bfs.length}/{MAX_BATTLEFIELDS})
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}

        {/* ── RUNES ──────────────────────────────────────────────────────── */}
        <SectionHead title="RUNES" filled={runeCount} max={MAX_RUNES} />
        {needLegend
          ? <Text style={styles.lockedNote}>Set your Legend to unlock allowed rune domains</Text>
          : <RuneSplitPanel
              domains={domains}
              runes={runes}
              onUpdate={(d0count, d1count) => persist(deck => {
                // Build rune slots: one entry per domain, each with synthetic id
                const newRunes = [];
                if (domains[0] && d0count > 0)
                  newRunes.push({ id: `rune-${domains[0]}`, name: `${domains[0]} Rune`, type: 'Rune', domain: domains[0], rarity: 'Common', count: d0count });
                if (domains[1] && d1count > 0)
                  newRunes.push({ id: `rune-${domains[1]}`, name: `${domains[1]} Rune`, type: 'Rune', domain: domains[1], rarity: 'Common', count: d1count });
                // Mono-color: if only 1 domain, d1count is ignored
                return { ...deck, slots: { ...deck.slots, runes: newRunes } };
              })}
            />
        }

        {/* ── MAIN DECK ──────────────────────────────────────────────────── */}
        <SectionHead title="MAIN DECK" filled={mainCount} max={MAX_MAIN} />
        <Text style={styles.deckNote}>
          Champion counts toward the 40. Max 3 copies per card.
          {domains.length > 0 ? ` Allowed: ${domains.join(', ')}.` : ''}
        </Text>
        {needLegend
          ? <Text style={styles.lockedNote}>Set your Legend to unlock allowed card domains</Text>
          : <>
              {/* Champion slot summary (inside main deck count) */}
              {champion && (
                <View style={styles.championInDeck}>
                  <Thumb card={champion} width={38} height={52} />
                  <View style={styles.cardRowInfo}>
                    <Text style={styles.cardRowName} numberOfLines={1}>{champion.name}</Text>
                    <Text style={[styles.cardRowDomain, { color: DOMAIN_COLORS[champion.domain] || COLORS.textMuted }]}>
                      Champion · {champion.domain}
                    </Text>
                  </View>
                  <View style={styles.countCtrl}>
                    <Text style={styles.countNum}>1</Text>
                    <Text style={styles.champFixed}>(fixed)</Text>
                  </View>
                </View>
              )}

              {main.map(c => (
                <CardRow
                  key={c.id}
                  card={c}
                  onAdd={card => addMore('main', card.id)}
                  onRemove={card => remove('main', card.id)}
                />
              ))}

              {mainCount < MAX_MAIN && (
                <AddMoreBtn
                  label={`Add Cards (${mainCount}/${MAX_MAIN})`}
                  onPress={() => setBrowseMode('main')}
                />
              )}
              {mainCount >= MAX_MAIN && (
                <Text style={styles.fullNote}>Main deck full ✓</Text>
              )}
            </>
        }

        {/* ── SIDEBOARD ──────────────────────────────────────────────────── */}
        <SectionHead title="SIDEBOARD" filled={sideCount} max={MAX_SIDEBOARD} />
        <Text style={styles.deckNote}>
          Bo3 swap cards. Max 3 copies across main deck + sideboard combined.
        </Text>
        {needLegend
          ? <Text style={styles.lockedNote}>Set your Legend to unlock sideboard</Text>
          : <>
              {side.map(c => (
                <CardRow
                  key={c.id}
                  card={c}
                  onAdd={card => addMore('sideboard', card.id)}
                  onRemove={card => remove('sideboard', card.id)}
                />
              ))}
              {sideCount < MAX_SIDEBOARD && (
                <AddMoreBtn
                  label={`Add Sideboard Cards (${sideCount}/${MAX_SIDEBOARD})`}
                  onPress={() => setBrowseMode('sideboard')}
                />
              )}
              {sideCount >= MAX_SIDEBOARD && (
                <Text style={styles.fullNote}>Sideboard full ✓</Text>
              )}
            </>
        }

      </ScrollView>

      <DeckStatsModal
        visible={showStats}
        deck={activeDeck}
        onClose={() => setShowStats(false)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rune Split Panel — inline counter UI with card art thumbnails
// ─────────────────────────────────────────────────────────────────────────────
const RuneSplitPanel = ({ domains, runes, onUpdate }) => {
  const [thumbs, setThumbs] = useState({});  // { [domain]: thumbnailUrl }

  // Fetch one sample rune card per domain to get its thumbnail
  useEffect(() => {
    let cancelled = false;
    const fetchThumbs = async () => {
      const results = {};
      for (const domain of domains) {
        if (!domain) continue;
        try {
          const res = await fetchCards({ type: 'Rune', faction: domain, rarity: 'Showcase', pageSize: 1 });
          if (!cancelled && res.cards?.[0]?.art?.thumbnailUrl) {
            results[domain] = res.cards[0].art.thumbnailUrl;
          }
        } catch (_) {}
      }
      if (!cancelled) setThumbs(results);
    };
    fetchThumbs();
    return () => { cancelled = true; };
  }, [domains.join(',')]);

  const countFor = (domain) => runes.find(r => r.domain === domain)?.count || 0;

  const d0 = domains[0] || null;
  const d1 = domains[1] || null;
  const c0 = countFor(d0);
  const c1 = d1 ? countFor(d1) : 0;
  const total = c0 + c1;
  const remaining = MAX_RUNES - total;
  const full = total >= MAX_RUNES;

  const change = (domain, delta) => {
    const cur0 = domain === d0 ? c0 + delta : c0;
    const cur1 = d1 ? (domain === d1 ? c1 + delta : c1) : 0;
    const n0 = Math.max(0, Math.min(MAX_RUNES, cur0));
    const n1 = Math.max(0, Math.min(MAX_RUNES, cur1));
    if (n0 + n1 > MAX_RUNES) return;
    onUpdate(n0, n1);
  };

  const color0 = DOMAIN_COLORS[d0] || COLORS.textMuted;
  const color1 = DOMAIN_COLORS[d1] || COLORS.textMuted;

  return (
    <View style={styles.runePanel}>
      {/* Split bar */}
      <View style={styles.runeBar}>
        <View style={[styles.runeBarFill, { flex: c0 || 0.01, backgroundColor: color0 }]} />
        {d1 && <View style={[styles.runeBarFill, { flex: c1 || 0.01, backgroundColor: color1 }]} />}
        <View style={[styles.runeBarFill, { flex: remaining || 0.01, backgroundColor: COLORS.bgElevated }]} />
      </View>

      <Text style={styles.runeTotalLabel}>
        {total} / {MAX_RUNES} runes{full ? '  ✓' : `  ·  ${remaining} remaining`}
      </Text>

      <RuneDomainRow
        domain={d0} color={color0} count={c0}
        thumb={thumbs[d0]}
        canIncrease={total < MAX_RUNES}
        onIncrease={() => change(d0, +1)}
        onDecrease={() => change(d0, -1)}
      />
      {d1 && (
        <RuneDomainRow
          domain={d1} color={color1} count={c1}
          thumb={thumbs[d1]}
          canIncrease={total < MAX_RUNES}
          onIncrease={() => change(d1, +1)}
          onDecrease={() => change(d1, -1)}
        />
      )}
    </View>
  );
};

const RuneDomainRow = ({ domain, color, count, thumb, canIncrease, onIncrease, onDecrease }) => (
  <View style={[styles.runeDomainRow, { borderLeftColor: color }]}>
    {/* Thumbnail or coloured fallback */}
    {thumb
      ? <Image source={{ uri: thumb }} style={styles.runeThumb} resizeMode="cover" />
      : <View style={[styles.runeThumb, styles.runeThumbPlaceholder, { borderColor: color }]}>
          <Ionicons name="sparkles-outline" size={16} color={color} />
        </View>
    }
    {/* Domain label */}
    <View style={styles.runeDomainInfo}>
      <Text style={[styles.runeDomainName, { color }]}>{domain}</Text>
      <Text style={styles.runeDomainSub}>Runes</Text>
    </View>
    {/* Counter */}
    <View style={styles.runeCountCtrl}>
      <TouchableOpacity
        style={[styles.runeCountBtn, count <= 0 && { opacity: 0.3 }]}
        onPress={onDecrease} disabled={count <= 0}
      >
        <Ionicons name="remove" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <Text style={[styles.runeCountNum, count > 0 && { color }]}>{count}</Text>
      <TouchableOpacity
        style={[styles.runeCountBtn, !canIncrease && { opacity: 0.3 }]}
        onPress={onIncrease} disabled={!canIncrease}
      >
        <Ionicons name="add" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Add More Button
// ─────────────────────────────────────────────────────────────────────────────
const AddMoreBtn = ({ label, onPress }) => (
  <TouchableOpacity style={styles.addMoreBtn} onPress={onPress} activeOpacity={0.8}>
    <Ionicons name="add-circle-outline" size={16} color={COLORS.arcaneBright} />
    <Text style={styles.addMoreText}>{label}</Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  // ── Deck list ────────────────────────────────────────────────────────────
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  screenTitle: { fontSize: 16, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 4 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.arcane, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
  },
  newBtnText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 },
  deckSlotCounter: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginLeft: 2 },
  deckSlotsLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Deck card in list
  deckCard: {
    flexDirection: 'row', backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  deckCardThumbWrap: { position: 'relative' },
  deckCardPips: {
    position: 'absolute', bottom: 4, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 3,
  },
  deckCardBody: { flex: 1, padding: SPACING.sm, gap: 3, justifyContent: 'center' },
  deckCardName:    { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  deckCardLegend:  { fontSize: 12, color: COLORS.textMuted },
  deckCardDomains: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  deckCardPills:   { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  deckCardDelete:  { padding: SPACING.md, justifyContent: 'center' },

  pill: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border,
  },
  pillFull: { borderColor: COLORS.win },
  pillText: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },
  pillTextFull: { color: COLORS.win },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
  emptyTitle: { fontSize: 18, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
  emptySub: { fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center' },
  emptyBtn: {
    marginTop: SPACING.lg, backgroundColor: COLORS.arcane,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
  },
  emptyBtnText: { color: COLORS.textPrimary, fontWeight: '700' },

  // ── Builder ──────────────────────────────────────────────────────────────
  builderHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm,
  },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  backBtnText: { color: COLORS.textPrimary, fontSize: 15 },
  builderName:    { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  builderDomains: { flexDirection: 'row', gap: SPACING.sm, marginTop: 2, flexWrap: 'wrap' },
  iconBtn: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  // Section headers
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.xs,
  },
  sectionTitle:    { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 3 },
  sectionCount:    { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  sectionCountFull:{ color: COLORS.win },

  // Slot rows (Legend / Champion / Battlefield)
  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginBottom: SPACING.xs,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3,
    overflow: 'hidden', padding: SPACING.sm,
  },
  slotInfo:    { flex: 1 },
  slotName:    { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  slotMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2, flexWrap: 'wrap' },
  slotSub:     { fontSize: 11, fontWeight: '600' },
  slotRule:    { fontSize: 11, color: COLORS.textMuted, lineHeight: 15, marginTop: 3 },
  removeBtn:   { padding: SPACING.xs },

  emptySlot: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginBottom: SPACING.xs,
    backgroundColor: COLORS.bgCard + '70', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed',
    padding: SPACING.sm,
  },
  emptySlotThumb: {
    width: 52, height: 72, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  emptySlotLabel: { flex: 1, fontSize: 13, color: COLORS.textMuted },

  // Card rows (runes / main deck)
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginBottom: 4,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  cardRowInfo:   { flex: 1, paddingVertical: SPACING.xs },
  cardRowName:   { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  cardRowMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardRowDomain: { fontSize: 11, fontWeight: '600' },
  cardRowRarity: { fontSize: 10, letterSpacing: 0.5 },

  countCtrl: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingRight: SPACING.sm },
  countBtn:  {
    width: 24, height: 24, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center',
  },
  countNum: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '700', minWidth: 20, textAlign: 'center' },

  // Champion row inside main deck
  championInDeck: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginBottom: 4,
    backgroundColor: COLORS.arcane + '20', borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.arcane + '60', overflow: 'hidden',
  },
  champFixed: { fontSize: 9, color: COLORS.textMuted, marginLeft: 2 },

  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs, paddingVertical: SPACING.sm,
  },
  addMoreText: { fontSize: 13, color: COLORS.arcaneBright, fontWeight: '600' },

  lockedNote: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', marginHorizontal: SPACING.md, marginBottom: SPACING.sm },
  fullNote:   { fontSize: 12, color: COLORS.win, marginHorizontal: SPACING.md, marginBottom: SPACING.sm },
  deckNote:   { fontSize: 11, color: COLORS.textMuted, marginHorizontal: SPACING.md, marginBottom: SPACING.xs },

  // Rune split panel
  runePanel: {
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
    padding: SPACING.md, gap: SPACING.sm,
  },
  runeBar: {
    flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1,
  },
  runeBarFill: { borderRadius: 3 },
  runeTotalLabel: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.5 },
  runeDomainRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderLeftWidth: 3, paddingLeft: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  runeThumb: { width: 44, height: 60, borderRadius: RADIUS.sm },
  runeThumbPlaceholder: {
    backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  runeDomainInfo: { flex: 1 },
  runeDomainName: { fontSize: 14, fontWeight: '700' },
  runeDomainSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  runeCountCtrl: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  runeCountBtn: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  runeCountNum: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, minWidth: 28, textAlign: 'center' },

  // Domain tags
  domainTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  domainTagText: { fontSize: 11, fontWeight: '600' },

  // Browse overlay
  browseBar: {
    backgroundColor: COLORS.bgCard, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
  },
  browseTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  browseHint:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  browseDoneBtn: {
    backgroundColor: COLORS.win, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  browseDoneBtnText: { fontSize: 12, fontWeight: '700', color: '#000' },
  liveBadge: {
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.xs,
  },
  liveBadgeFull: { borderColor: COLORS.win, backgroundColor: COLORS.win + '20' },
  liveBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  liveBadgeTextFull: { color: COLORS.win },

  // Thumb placeholder
  thumbPlaceholder: {
    backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: SPACING.lg },
  modalBox: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 14, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 4, marginBottom: SPACING.md },
  modalInput: {
    backgroundColor: COLORS.bgInput, color: COLORS.textPrimary,
    borderRadius: RADIUS.sm, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, fontSize: 16, marginBottom: SPACING.md,
  },
  modalRow:   { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn:  { flex: 1, padding: SPACING.md, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgElevated, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  confirmBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.sm, backgroundColor: COLORS.arcane, alignItems: 'center' },
  confirmBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
});
