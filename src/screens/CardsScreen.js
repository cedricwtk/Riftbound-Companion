import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ActivityIndicator, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { fetchCards, DOMAIN_COLORS } from '../utils/api';

const CARD_TYPES = ['', 'Unit', 'Spell', 'Battlefield', 'Gear', 'Legend', 'Champion'];
const DOMAINS = ['', 'Fury', 'Body', 'Calm', 'Mind', 'Order', 'Chaos', 'Colorless'];

// ── Card Tile ────────────────────────────────────────────────────────────────
const CardTile = ({ card, onPress }) => {
  const domainColor = DOMAIN_COLORS[card.domain] || COLORS.textSecondary;
  return (
    <TouchableOpacity style={styles.cardTile} onPress={() => onPress(card)} activeOpacity={0.8}>
      {card.art?.thumbnailUrl ? (
        <Image source={{ uri: card.art.thumbnailUrl }} style={styles.cardThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}>
          <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
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
        <Text style={styles.cardRarity}>{card.rarity}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Card Detail Modal ────────────────────────────────────────────────────────
const CardDetailModal = ({ card, visible, onClose, onAddToDeck }) => {
  if (!card) return null;
  const domainColor = DOMAIN_COLORS[card.domain] || COLORS.textSecondary;
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
              <Text style={styles.detailRarity}>{card.rarity}</Text>
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
            <TouchableOpacity style={styles.addToDeckBtn} onPress={() => onAddToDeck(card)}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.textPrimary} />
              <Text style={styles.addToDeckBtnText}>Add to Deck</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function CardsScreen({ onAddToDeck }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const loadCards = useCallback(async (reset = false) => {
    if (loading) return;
    const currentPage = reset ? 1 : page;
    setLoading(true);
    const result = await fetchCards({
      page: currentPage,
      pageSize: 20,
      search,
      faction: filterDomain,
      type: filterType,
    });
    setCards(prev => reset ? result.cards : [...prev, ...result.cards]);
    setTotal(result.total);
    if (!reset) setPage(p => p + 1);
    else setPage(2);
    setLoading(false);
  }, [search, filterDomain, filterType, page, loading]);

  useEffect(() => {
    const timer = setTimeout(() => loadCards(true), 400);
    return () => clearTimeout(timer);
  }, [search, filterDomain, filterType]);

  const loadMore = () => {
    if (cards.length < total) loadCards(false);
  };

  const hasFilters = filterDomain || filterType;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Search bar */}
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
        <TouchableOpacity
          style={[styles.filterBtn, hasFilters && styles.filterBtnActive]}
          onPress={() => setShowFilters(v => !v)}
        >
          <Ionicons name="options-outline" size={18} color={hasFilters ? COLORS.goldLight : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      {showFilters && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>DOMAIN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {DOMAINS.map(d => (
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
            {CARD_TYPES.map(t => (
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
        </View>
      )}

      <Text style={styles.resultsCount}>
        {total > 0 ? `${total} cards` : loading ? 'Loading...' : 'No cards found'}
      </Text>

      <FlatList
        data={cards}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <CardTile card={item} onPress={setSelectedCard} />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading ? <ActivityIndicator color={COLORS.arcane} style={{ margin: SPACING.lg }} /> : null}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Cards Found</Text>
              <Text style={styles.emptySubtitle}>
                Make sure your Scrydex API key is set in src/utils/api.js
              </Text>
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
  cardRarity: { fontSize: 10, color: COLORS.goldDark, letterSpacing: 1 },

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
  detailRarity: { fontSize: 13, color: COLORS.goldDark },
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
    backgroundColor: COLORS.arcane, padding: SPACING.md, margin: SPACING.md,
    borderRadius: RADIUS.md,
  },
  addToDeckBtnText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
});