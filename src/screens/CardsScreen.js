import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ActivityIndicator, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { fetchCards, DOMAIN_COLORS, RARITIES } from '../utils/api';

const ALL_CARD_TYPES = ['', 'Unit', 'Spell', 'Battlefield', 'Gear', 'Rune', 'Legend', 'Champion'];
const ALL_DOMAINS    = ['', 'Fury', 'Body', 'Calm', 'Mind', 'Order', 'Chaos', 'Colorless'];

// ── Card Tile ────────────────────────────────────────────────────────────────
// deckCounts: { [cardId]: number } — current count in deck
// maxCount:   per-card cap (default 3, battlefields use 1)
// onAdd / onRemove: increment/decrement callbacks
const CardTile = ({ card, onPress, dimmed, deckCounts, maxCount = 3, onAdd, onRemove }) => {
  const domainColor = DOMAIN_COLORS[card.domain] || COLORS.textSecondary;
  const rarityColor = RARITIES.find(r => r.value === card.rarity)?.color || COLORS.textMuted;
  const count       = deckCounts ? (deckCounts[card.name] || 0) : 0;
  const atMax       = count >= maxCount;
  const inDeck      = count > 0;
  const counterMode = !!deckCounts;

  return (
    <TouchableOpacity
      style={[styles.cardTile, dimmed && styles.cardTileDimmed, inDeck && styles.cardTileInDeck]}
      onPress={() => onPress(card)}
      activeOpacity={0.85}
    >
      {card.art?.thumbnailUrl ? (
        <Image source={{ uri: card.art.thumbnailUrl }} style={styles.cardThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}>
          <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
        </View>
      )}
      {/* In-deck count badge on thumbnail */}
      {inDeck && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      )}

      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>
        <View style={styles.cardMeta}>
          <View style={[styles.domainDot, { backgroundColor: domainColor }]} />
          <Text style={[styles.cardDomain, { color: domainColor }]}>{card.domain || '—'}</Text>
          <Text style={styles.cardType}>{card.type}</Text>
        </View>
        {card.stats && (
          <View style={styles.statsRow}>
            {card.stats.cost !== undefined && (
              <View style={styles.statChip}>
                <Text style={styles.statLabel}>Cost</Text>
                <Text style={styles.statVal}>{card.stats.cost}</Text>
              </View>
            )}
            {card.stats.power !== undefined && (
              <View style={styles.statChip}>
                <Text style={styles.statLabel}>Pow</Text>
                <Text style={styles.statVal}>{card.stats.power}</Text>
              </View>
            )}
            {card.stats.might !== undefined && (
              <View style={styles.statChip}>
                <Text style={styles.statLabel}>Mgt</Text>
                <Text style={styles.statVal}>{card.stats.might}</Text>
              </View>
            )}
          </View>
        )}
        <Text style={[styles.cardRarity, { color: rarityColor }]}>{card.rarity}</Text>
      </View>

      {/* Inline counter — only when in counter mode */}
      {counterMode && (
        <View style={styles.tileCounter}>
          <TouchableOpacity
            style={[styles.tileCountBtn, !inDeck && styles.tileCountBtnDisabled]}
            onPress={(e) => { e.stopPropagation?.(); onRemove?.(card); }}
            disabled={!inDeck}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="remove" size={16} color={inDeck ? COLORS.textPrimary : COLORS.textMuted} />
          </TouchableOpacity>
          <Text style={[styles.tileCountNum, atMax && { color: COLORS.win }]}>{count}</Text>
          <TouchableOpacity
            style={[styles.tileCountBtn, atMax && styles.tileCountBtnDisabled]}
            onPress={(e) => { e.stopPropagation?.(); onAdd?.(card); }}
            disabled={atMax}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={16} color={atMax ? COLORS.textMuted : COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ── Card Detail Modal ────────────────────────────────────────────────────────
const CardDetailModal = ({ card, visible, onClose, onAddToDeck, addToDeckLabel, isAllowed }) => {
  if (!card) return null;

  const handleAdd = () => {
    onAddToDeck(card);
    onClose(); // auto-close after adding
  };
  const domainColor = DOMAIN_COLORS[card.domain] || COLORS.textSecondary;
  const rarityColor = RARITIES.find(r => r.value === card.rarity)?.color || COLORS.textMuted;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.detailOverlay}>
        <View style={styles.detailModal}>
          <TouchableOpacity style={styles.detailClose} onPress={onClose}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {card.art?.fullUrl ? (
            <Image source={{ uri: card.art.fullUrl }} style={styles.detailImage} resizeMode="contain" />
          ) : (
            <View style={[styles.detailImage, styles.cardThumbPlaceholder]}>
              <Ionicons name="image-outline" size={48} color={COLORS.textMuted} />
            </View>
          )}
          <ScrollView style={styles.detailContent}>
            <Text style={styles.detailName}>{card.name}</Text>
            <View style={styles.detailMeta}>
              <Text style={[styles.detailDomain, { color: domainColor }]}>{card.domain}</Text>
              <Text style={styles.detailType}>{card.type}</Text>
              <Text style={[styles.detailRarity, { color: rarityColor }]}>{card.rarity}</Text>
            </View>
            {card.stats && (
              <View style={styles.detailStats}>
                {Object.entries(card.stats).map(([k, v]) => (
                  <View key={k} style={styles.detailStatChip}>
                    <Text style={styles.detailStatLabel}>{k.toUpperCase()}</Text>
                    <Text style={styles.detailStatVal}>{v}</Text>
                  </View>
                ))}
              </View>
            )}
            {card.rules?.map((rule, i) => (
              <Text key={i} style={styles.detailRule}>{rule}</Text>
            ))}
            {card.flavorText && (
              <Text style={styles.detailFlavor}>"{card.flavorText}"</Text>
            )}
          </ScrollView>
          {onAddToDeck && (
            isAllowed === false ? (
              <View style={styles.notAllowedBanner}>
                <Ionicons name="ban-outline" size={16} color={COLORS.danger} />
                <Text style={styles.notAllowedText}>Not in your deck's allowed domains</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.addToDeckBtn} onPress={handleAdd}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.textPrimary} />
                <Text style={styles.addToDeckBtnText}>{addToDeckLabel || 'Add to Deck'}</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    </Modal>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────
// Props:
//   onAddToDeck      callback when user taps Add button
//   addToDeckLabel   button label override
//   forcedType       lock cards to a single type (e.g. 'Battlefield', 'Rune')
//   forcedDomains    array of allowed domains — cards outside are dimmed/blocked
//   hideLegend       hide Legend cards from results
//   hideBattlefield  hide Battlefield cards from results
export default function CardsScreen({
  onAddToDeck,
  addToDeckLabel,
  forcedType,
  forcedDomains,
  hideLegend,
  hideBattlefield,
  excludeRarity,     // exclude cards with this rarity (e.g. 'Showcase')
  deckCounts,        // { [cardId]: count } — for inline counter mode
  onRemoveFromDeck,  // callback to decrement a card
  maxCount = 3,      // per-card cap (battlefields: 1)
}) {
  const [cards, setCards]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [page, setPage]                 = useState(1);
  const [total, setTotal]               = useState(0);
  const [search, setSearch]             = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterType, setFilterType]     = useState(forcedType || '');
  const [filterRarity, setFilterRarity] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showFilters, setShowFilters]   = useState(false);

  // Restrict domain chips when forcedDomains set
  const availableDomains = forcedDomains ? ['', ...forcedDomains] : ALL_DOMAINS;
  const availableTypes   = forcedType    ? [forcedType]           : ALL_CARD_TYPES;

  const isCardAllowed = useCallback((card) => {
    if (!forcedDomains || forcedDomains.length === 0) return true;
    return forcedDomains.includes(card.domain);
  }, [forcedDomains]);

  const loadCards = useCallback(async (reset = false) => {
    if (loading) return;
    const currentPage = reset ? 1 : page;
    setLoading(true);
    const result = await fetchCards({
      page: currentPage,
      pageSize: 20,
      search,
      faction: filterDomain,
      type: filterType || forcedType || '',
      rarity: filterRarity,
    });

    let filtered = result.cards;
    // Client-side domain filtering when multiple domains enforced
    if (forcedDomains && forcedDomains.length > 0 && !filterDomain) {
      filtered = filtered.filter(c => forcedDomains.includes(c.domain));
    }
    if (hideLegend)      filtered = filtered.filter(c => c.type !== 'Legend');
    if (hideBattlefield) filtered = filtered.filter(c => c.type !== 'Battlefield');
    if (excludeRarity)   filtered = filtered.filter(c => c.rarity !== excludeRarity);

    setCards(prev => {
      const merged = reset ? filtered : [...prev, ...filtered];
      // Deduplicate by id — pagination can return overlapping results
      const seen = new Set();
      return merged.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    });
    setTotal(result.total);
    if (!reset) setPage(p => p + 1);
    else setPage(2);
    setLoading(false);
  }, [search, filterDomain, filterType, filterRarity, page, loading,
      forcedType, forcedDomains, hideLegend, hideBattlefield, excludeRarity]);

  useEffect(() => {
    const timer = setTimeout(() => loadCards(true), 400);
    return () => clearTimeout(timer);
  }, [search, filterDomain, filterType, filterRarity]);

  const loadMore = () => { if (cards.length < total) loadCards(false); };

  const hasFilters = filterDomain || (filterType && filterType !== forcedType) || filterRarity;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Search row */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cards..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        {/* Hide filter toggle when type is fully locked */}
        {!forcedType && (
          <TouchableOpacity
            style={[styles.filterBtn, hasFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(v => !v)}
          >
            <Ionicons name="options-outline" size={18} color={hasFilters ? COLORS.goldLight : COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter panel */}
      {showFilters && !forcedType && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>DOMAIN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {availableDomains.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, filterDomain === d && styles.chipActive]}
                onPress={() => setFilterDomain(d)}
              >
                {d && <View style={[styles.chipDot, { backgroundColor: DOMAIN_COLORS[d] }]} />}
                <Text style={[styles.chipText, filterDomain === d && styles.chipTextActive]}>
                  {d || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {availableTypes.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, filterType === t && styles.chipActive]}
                onPress={() => setFilterType(t)}
              >
                <Text style={[styles.chipText, filterType === t && styles.chipTextActive]}>
                  {t || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>RARITY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {RARITIES.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[
                  styles.chip,
                  filterRarity === r.value && styles.chipActive,
                  filterRarity === r.value && { borderColor: r.color },
                ]}
                onPress={() => setFilterRarity(r.value)}
              >
                <View style={[styles.chipDot, { backgroundColor: r.color }]} />
                <Text style={[
                  styles.chipText,
                  filterRarity === r.value && styles.chipTextActive,
                  filterRarity === r.value && { color: r.color },
                ]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={styles.resultsCount}>
        {cards.length > 0 ? `${cards.length} cards` : loading ? 'Loading...' : 'No cards found'}
      </Text>

      <FlatList
        data={cards}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item }) => (
          <CardTile
            card={item}
            onPress={setSelectedCard}
            dimmed={!isCardAllowed(item)}
            deckCounts={deckCounts}
            maxCount={maxCount}
            onAdd={onAddToDeck ? () => onAddToDeck(item) : undefined}
            onRemove={onRemoveFromDeck ? () => onRemoveFromDeck(item) : undefined}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading ? <ActivityIndicator color={COLORS.arcane} style={{ margin: SPACING.lg }} /> : null}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Cards Found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
      />

      <CardDetailModal
        card={selectedCard}
        visible={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        onAddToDeck={onAddToDeck}
        addToDeckLabel={addToDeckLabel}
        isAllowed={selectedCard ? isCardAllowed(selectedCard) : true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  searchRow: {
    flexDirection: 'row', padding: SPACING.md, gap: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15, paddingVertical: 10 },
  filterBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterBtnActive: { borderColor: COLORS.gold, backgroundColor: COLORS.bgElevated },
  filterSection: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterLabel: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 2, marginBottom: SPACING.xs },
  chipsRow: { marginBottom: SPACING.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard,
    marginRight: SPACING.xs, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.arcane, borderColor: COLORS.arcaneBright },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.textPrimary, fontWeight: '600' },
  resultsCount: { fontSize: 11, color: COLORS.textMuted, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, letterSpacing: 1 },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },
  cardTile: {
    flexDirection: 'row', backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTileInDeck: { borderColor: COLORS.arcane + '90' },
  cardTileDimmed: { opacity: 0.3 },
  cardThumb: { width: 90, height: 126 },
  cardThumbPlaceholder: { backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, padding: SPACING.sm, justifyContent: 'space-between' },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  domainDot: { width: 6, height: 6, borderRadius: 3 },
  cardDomain: { fontSize: 11, fontWeight: '600' },
  cardType: { fontSize: 11, color: COLORS.textMuted },
  statsRow: { flexDirection: 'row', gap: SPACING.xs },
  statChip: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.sm,
    paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center',
  },
  statLabel: { fontSize: 8, color: COLORS.textMuted, letterSpacing: 0.5 },
  statVal: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '700' },
  cardRarity: { fontSize: 10, letterSpacing: 1 },

  // In-deck count badge on thumbnail
  countBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: COLORS.arcane, borderRadius: RADIUS.full,
    minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 1, borderColor: COLORS.arcaneBright,
  },
  countBadgeText: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '800' },

  // Inline tile counter (right side)
  tileCounter: {
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
    borderLeftWidth: 1, borderLeftColor: COLORS.border,
  },
  tileCountBtn: {
    width: 30, height: 30, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  tileCountBtnDisabled: { opacity: 0.25 },
  tileCountNum: {
    fontSize: 16, fontWeight: '800', color: COLORS.textPrimary,
    minWidth: 20, textAlign: 'center',
  },
  emptyState: { alignItems: 'center', padding: SPACING.xxl },
  emptyTitle: { fontSize: 18, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center' },
  // Detail Modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  detailModal: {
    backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    maxHeight: '90%', borderTopWidth: 1, borderColor: COLORS.border,
  },
  detailClose: { position: 'absolute', top: SPACING.sm, right: SPACING.sm, zIndex: 10, padding: SPACING.sm },
  detailImage: { width: '100%', height: 320, backgroundColor: COLORS.bgElevated },
  detailContent: { padding: SPACING.md },
  detailName: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  detailMeta: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: 'wrap' },
  detailDomain: { fontSize: 13, fontWeight: '600' },
  detailType: { fontSize: 13, color: COLORS.textSecondary },
  detailRarity: { fontSize: 13 },
  detailStats: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  detailStatChip: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  detailStatLabel: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 1 },
  detailStatVal: { fontSize: 18, color: COLORS.textPrimary, fontWeight: '800' },
  detailRule: { fontSize: 14, color: COLORS.textPrimary, marginBottom: SPACING.sm, lineHeight: 20 },
  detailFlavor: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic', marginTop: SPACING.sm, lineHeight: 20 },
  addToDeckBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.arcane, padding: SPACING.md, margin: SPACING.md, borderRadius: RADIUS.md,
  },
  addToDeckBtnText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
  notAllowedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.bgElevated, padding: SPACING.md, margin: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.danger + '50',
  },
  notAllowedText: { color: COLORS.danger, fontSize: 13, fontWeight: '600' },
});
