import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Animated, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { fetchCards, RARITIES } from '../utils/api';
import { getCollection, toggleCollectionCard } from '../utils/storage';

// Rarity rows (skip "All")
const RARITY_LIST = RARITIES.filter(r => r.value !== '');

// Metadata categories with their own colors
const META_CATEGORIES = [
  { key: 'alternate_art', label: 'Alternate Art', color: '#2EC4B6' },
  { key: 'overnumbered',  label: 'Overnumbered',  color: '#FF9F43' },
  { key: 'signature',     label: 'Signature',      color: '#C0C8D8' },
];

// ── Animated Progress Bar ─────────────────────────────────────────────────────
const ProgressBar = ({ label, color, owned, total }) => {
  const pct  = total > 0 ? owned / total : 0;
  const anim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [pct]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressLabelRow}>
        <View style={[styles.rarityDot, { backgroundColor: color }]} />
        <Text style={[styles.rarityLabel, { color }]}>{label}</Text>
        <Text style={styles.progressCount}>
          {owned}<Text style={styles.progressTotal}>/{total}</Text>
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
};

// ── Set Filter Chip ───────────────────────────────────────────────────────────
const SetChip = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

// ── Collection Card Row ───────────────────────────────────────────────────────
const CollectionRow = React.memo(({ card, owned, onToggle }) => {
  const rarityColor = RARITIES.find(r => r.value === card.rarity)?.color || COLORS.textMuted;
  const hasMeta = card.metadata?.alternate_art || card.metadata?.overnumbered || card.metadata?.signature;

  return (
    <View style={[styles.cardRow, owned && styles.cardRowOwned]}>
      {card.art?.thumbnailUrl ? (
        <Image source={{ uri: card.art.thumbnailUrl }} style={styles.cardThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}>
          <Ionicons name="image-outline" size={18} color={COLORS.textMuted} />
        </View>
      )}
      <View style={styles.cardRowInfo}>
        <View style={styles.cardRowNameRow}>
          <Text style={styles.cardRowName} numberOfLines={1}>{card.name}</Text>
          {card.collector_number != null && (
            <Text style={styles.cardNum}>#{card.collector_number}</Text>
          )}
        </View>
        <View style={styles.cardRowMeta}>
          <Text style={[styles.rarityPill, { color: rarityColor, borderColor: rarityColor + '55' }]}>
            {card.rarity}
          </Text>
          {card.metadata?.alternate_art && <Text style={[styles.metaBadge, { color: '#2EC4B6' }]}>ALT</Text>}
          {card.metadata?.overnumbered  && <Text style={[styles.metaBadge, { color: '#FF9F43' }]}>OVR</Text>}
          {card.metadata?.signature     && <Text style={[styles.metaBadge, { color: '#C0C8D8' }]}>SIG</Text>}
        </View>
      </View>
      <TouchableOpacity
        style={styles.ownBtn}
        onPress={() => onToggle(card.id)}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}
      >
        <Ionicons
          name={owned ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={owned ? COLORS.win : COLORS.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
});

// ── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({ setId, setLabel, owned, total }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      <Text style={styles.sectionHeaderId}>{setId}</Text>
      <Text style={styles.sectionHeaderLabel}>{setLabel}</Text>
    </View>
    <View style={styles.sectionHeaderRight}>
      <Text style={styles.sectionHeaderCount}>{owned}/{total}</Text>
      <Text style={styles.sectionHeaderPct}>
        {total > 0 ? Math.round((owned / total) * 100) : 0}%
      </Text>
    </View>
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MastersetScreen() {
  const [view, setView]               = useState('summary'); // 'summary' | 'cards'
  const [cards, setCards]             = useState([]);
  const [collection, setCollection]   = useState(new Set());
  const [loading, setLoading]         = useState(true);
  const [selectedSet, setSelectedSet] = useState('ALL');
  const [exporting, setExporting]     = useState(false);
  const listRef  = useRef(null);
  const shareRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ cards: allCards }, col] = await Promise.all([fetchCards(), getCollection()]);
      // Sort by set ID alphabetically, then by collector_number ascending
      const sorted = [...allCards].sort((a, b) => {
        const setDiff = (a.set || '').localeCompare(b.set || '');
        if (setDiff !== 0) return setDiff;
        return (a.collector_number ?? 9999) - (b.collector_number ?? 9999);
      });
      setCards(sorted);
      setCollection(col);
    } catch (e) {
      console.error('MastersetScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const shareProgress = async () => {
    // TODO: gate behind premium when freemium is activated
    if (!shareRef.current) return;
    setExporting(true);
    try {
      const uri = await captureRef(shareRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'My Riftbound Collection' });
    } catch (e) {
      Alert.alert('Export failed', 'Could not generate the image.');
    } finally {
      setExporting(false);
    }
  };

  const handleToggle = useCallback(async (cardId) => {
    const updated = await toggleCollectionCard(cardId);
    setCollection(new Set(updated));
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const totalOwned = collection.size;
  const totalCards = cards.length;

  // Unique sets sorted
  const sets = ['ALL', ...Array.from(new Set(cards.map(c => c.set).filter(Boolean))).sort()];
  const setLabels = Object.fromEntries(cards.map(c => [c.set, c.set_label]));

  // Rarity stats (across all cards)
  const rarityStats = RARITY_LIST.map(r => {
    const rc = cards.filter(c => c.rarity === r.value);
    return { rarity: r, owned: rc.filter(c => collection.has(c.id)).length, total: rc.length };
  });

  // Metadata stats (across all cards)
  const metaStats = META_CATEGORIES.map(m => {
    const mc = cards.filter(c => c.metadata?.[m.key]);
    return { ...m, owned: mc.filter(c => collection.has(c.id)).length, total: mc.length };
  });

  // Filtered + sectioned list data (exclude cards with no set)
  const filteredCards = (selectedSet === 'ALL' ? cards : cards.filter(c => c.set === selectedSet))
    .filter(c => !!c.set);

  const listData = (() => {
    const groups = {};
    filteredCards.forEach(card => {
      const k = card.set || '??';
      if (!groups[k]) groups[k] = [];
      groups[k].push(card);
    });
    const result = [];
    Object.keys(groups).sort().forEach(setId => {
      const groupCards = groups[setId];
      const ownedInGroup = groupCards.filter(c => collection.has(c.id)).length;
      result.push({
        type: 'header', setId,
        setLabel: setLabels[setId] || setId,
        owned: ownedInGroup,
        total: groupCards.length,
      });
      groupCards.forEach(card => result.push({ type: 'card', card }));
    });
    return result;
  })();

  // ── Summary view ──────────────────────────────────────────────────────────
  const renderSummary = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.summaryContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.summaryHeader}>
        <Text style={styles.screenTitle}>MASTERSET</Text>
        <Text style={styles.screenSubtitle}>Collection Progress</Text>
      </View>

      {/* Overall */}
      <View style={styles.overallCard}>
        <Text style={styles.overallLabel}>TOTAL COLLECTED</Text>
        <Text style={styles.overallCount}>{totalOwned}</Text>
        <Text style={styles.overallTotal}>/ {totalCards} cards</Text>
        {totalCards > 0 && (
          <Text style={styles.overallPct}>{Math.round((totalOwned / totalCards) * 100)}%</Text>
        )}
      </View>

      {/* By Rarity */}
      <Text style={styles.sectionTitle}>BY RARITY</Text>
      <View style={styles.progressSection}>
        {rarityStats.filter(s => s.total > 0).map(({ rarity, owned, total }) => (
          <ProgressBar key={rarity.value} label={rarity.label} color={rarity.color} owned={owned} total={total} />
        ))}
      </View>

      {/* Special Prints */}
      {metaStats.some(m => m.total > 0) && (
        <>
          <Text style={styles.sectionTitle}>SPECIAL PRINTS</Text>
          <View style={styles.progressSection}>
            {metaStats.filter(m => m.total > 0).map(m => (
              <ProgressBar key={m.key} label={m.label} color={m.color} owned={m.owned} total={m.total} />
            ))}
          </View>
        </>
      )}

      {/* ── Shareable export card (hidden visually but captured for export) ── */}
      <View style={styles.shareCardWrapper} ref={shareRef} collapsable={false}>
        <LinearGradient
          colors={['#0A0A0F', '#12121A', '#1A1424']}
          style={styles.shareCard}
        >
          <View style={styles.shareCardHeader}>
            <Text style={styles.shareCardTitle}>RIFTBOUND</Text>
            <Text style={styles.shareCardSubtitle}>MASTERSET PROGRESS</Text>
          </View>

          <View style={styles.shareCardTotal}>
            <Text style={styles.shareCardCount}>{totalOwned}</Text>
            <Text style={styles.shareCardDivider}>/</Text>
            <Text style={styles.shareCardTotalNum}>{totalCards}</Text>
            <View style={styles.shareCardPctBadge}>
              <Text style={styles.shareCardPct}>{totalCards > 0 ? Math.round((totalOwned / totalCards) * 100) : 0}%</Text>
            </View>
          </View>

          <View style={styles.shareCardBars}>
            {rarityStats.filter(s => s.total > 0).map(({ rarity, owned, total }) => (
              <View key={rarity.value} style={styles.shareBarRow}>
                <Text style={[styles.shareBarLabel, { color: rarity.color }]}>{rarity.label}</Text>
                <View style={styles.shareBarTrack}>
                  <View style={[styles.shareBarFill, { width: `${Math.round((owned / total) * 100)}%`, backgroundColor: rarity.color }]} />
                </View>
                <Text style={styles.shareBarCount}>{owned}/{total}</Text>
              </View>
            ))}
            {metaStats.filter(m => m.total > 0).map(m => (
              <View key={m.key} style={styles.shareBarRow}>
                <Text style={[styles.shareBarLabel, { color: m.color }]}>{m.label}</Text>
                <View style={styles.shareBarTrack}>
                  <View style={[styles.shareBarFill, { width: `${Math.round((m.owned / m.total) * 100)}%`, backgroundColor: m.color }]} />
                </View>
                <Text style={styles.shareBarCount}>{m.owned}/{m.total}</Text>
              </View>
            ))}
          </View>

          <View style={styles.shareCardFooter}>
            <Text style={styles.shareCardFooterText}>riftbound-companion</Text>
          </View>
        </LinearGradient>
      </View>

      {/* ── Buttons ── */}
      <TouchableOpacity style={styles.shareBtn} onPress={shareProgress} disabled={exporting}>
        <Ionicons name={exporting ? 'hourglass-outline' : 'share-social-outline'} size={18} color={COLORS.gold} />
        <Text style={styles.shareBtnText}>{exporting ? 'EXPORTING…' : 'SHARE PROGRESS'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.viewCardsBtn} onPress={() => setView('cards')}>
        <Ionicons name="grid-outline" size={18} color={COLORS.bg} />
        <Text style={styles.viewCardsBtnText}>VIEW COLLECTION</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Cards view ────────────────────────────────────────────────────────────
  const renderCardsView = () => (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.cardsHeader}>
        <TouchableOpacity onPress={() => setView('summary')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.gold} />
          <Text style={styles.backBtnText}>MASTERSET</Text>
        </TouchableOpacity>
        <Text style={styles.cardsHeaderCount}>{totalOwned}/{totalCards}</Text>
      </View>

      {/* Set filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chipBarContent}>
        {sets.map(s => (
          <SetChip
            key={s}
            label={s === 'ALL' ? 'All Sets' : s}
            active={selectedSet === s}
            onPress={() => {
              setSelectedSet(s);
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
            }}
          />
        ))}
      </ScrollView>

      {/* Card list with section headers */}
      <FlatList
        ref={listRef}
        data={listData}
        keyExtractor={(item, i) => item.type === 'header' ? `h-${item.setId}` : item.card.id}
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <SectionHeader setId={item.setId} setLabel={item.setLabel} owned={item.owned} total={item.total} />
          ) : (
            <CollectionRow card={item.card} owned={collection.has(item.card.id)} onToggle={handleToggle} />
          )
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={({ leadingItem }) =>
          leadingItem?.type === 'header' ? null : <View style={styles.separator} />
        }
        initialNumToRender={25}
        maxToRenderPerBatch={25}
        windowSize={10}
      />
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Loading cards…</Text>
        </View>
      ) : view === 'summary' ? renderSummary() : renderCardsView()}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: COLORS.textMuted, fontSize: 14 },

  // ── Summary ──────────────────────────────────────────────────────────────
  summaryContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  summaryHeader: { alignItems: 'center', marginBottom: SPACING.lg },
  screenTitle: {
    fontSize: 26, fontWeight: '800', color: COLORS.gold,
    letterSpacing: 3, fontFamily: 'serif',
  },
  screenSubtitle: { fontSize: 12, color: COLORS.textMuted, letterSpacing: 2, marginTop: 2 },

  overallCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.md,
  },
  overallLabel: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 2, marginBottom: SPACING.xs },
  overallCount: { fontSize: 48, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 52 },
  overallTotal: { fontSize: 16, color: COLORS.textSecondary, marginTop: 2 },
  overallPct:   { fontSize: 14, color: COLORS.gold, fontWeight: '700', marginTop: SPACING.xs },

  sectionTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 2, marginBottom: SPACING.sm, marginTop: SPACING.xs,
  },
  progressSection: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.md, marginBottom: SPACING.md,
  },
  progressRow: { gap: 6 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rarityDot: { width: 8, height: 8, borderRadius: 4 },
  rarityLabel: { fontSize: 13, fontWeight: '700', flex: 1, letterSpacing: 0.5 },
  progressCount: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  progressTotal: { color: COLORS.textMuted, fontWeight: '400' },
  progressTrack: {
    height: 6, backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: RADIUS.full },

  viewCardsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.gold, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, gap: 8, marginTop: SPACING.sm,
  },
  viewCardsBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: 13, letterSpacing: 2 },

  // ── Cards view ────────────────────────────────────────────────────────────
  cardsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backBtnText: { color: COLORS.gold, fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  cardsHeaderCount: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },

  chipBar: { borderBottomWidth: 1, borderBottomColor: COLORS.border, flexShrink: 0 },
  chipBarContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard, flexShrink: 0,
  },
  chipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.5, flexShrink: 0 },
  chipTextActive: { color: COLORS.bg },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 3, borderTopColor: COLORS.gold,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    marginTop: SPACING.md,
  },
  sectionHeaderLeft: { gap: 2 },
  sectionHeaderId: { fontSize: 16, fontWeight: '800', color: COLORS.gold, letterSpacing: 2, fontFamily: 'serif' },
  sectionHeaderLabel: { fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1 },
  sectionHeaderRight: { alignItems: 'flex-end', gap: 2 },
  sectionHeaderCount: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  sectionHeaderPct: { fontSize: 10, color: COLORS.textMuted },

  listContent: { paddingBottom: SPACING.xl },

  cardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, opacity: 0.55 },
  cardRowOwned: { opacity: 1 },
  cardThumb: { width: 44, height: 60, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgElevated, marginRight: SPACING.sm },
  cardThumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardRowInfo: { flex: 1, gap: 4 },
  cardRowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardRowName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  cardNum: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  cardRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rarityPill: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
    borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 5, paddingVertical: 1,
  },
  metaBadge: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  ownBtn: { padding: 4, paddingLeft: SPACING.sm },
  separator: { height: 1, backgroundColor: COLORS.border, opacity: 0.4, marginHorizontal: SPACING.md },

  // ── Share card ────────────────────────────────────────────────────────────
  shareCardWrapper: {
    position: 'absolute', left: -9999, top: -9999,
    width: 360,
  },
  shareCard: {
    padding: 24, borderRadius: RADIUS.md,
  },
  shareCardHeader: { alignItems: 'center', marginBottom: 16 },
  shareCardTitle: {
    fontSize: 22, fontWeight: '800', color: COLORS.gold,
    letterSpacing: 4, fontFamily: 'serif',
  },
  shareCardSubtitle: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 3, marginTop: 2 },

  shareCardTotal: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6, marginBottom: 20 },
  shareCardCount: { fontSize: 52, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 56 },
  shareCardDivider: { fontSize: 32, color: COLORS.textMuted, lineHeight: 56 },
  shareCardTotalNum: { fontSize: 32, color: COLORS.textSecondary, lineHeight: 56 },
  shareCardPctBadge: {
    backgroundColor: COLORS.gold + '22', borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.gold + '66',
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6, marginLeft: 4,
  },
  shareCardPct: { fontSize: 16, fontWeight: '800', color: COLORS.gold },

  shareCardBars: { gap: 8, marginBottom: 20 },
  shareBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareBarLabel: { fontSize: 11, fontWeight: '700', width: 80, letterSpacing: 0.3 },
  shareBarTrack: { flex: 1, height: 6, backgroundColor: '#FFFFFF15', borderRadius: RADIUS.full, overflow: 'hidden' },
  shareBarFill: { height: '100%', borderRadius: RADIUS.full },
  shareBarCount: { fontSize: 10, color: COLORS.textMuted, width: 40, textAlign: 'right' },

  shareCardFooter: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#FFFFFF15', paddingTop: 12 },
  shareCardFooterText: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },

  // ── Share button ──────────────────────────────────────────────────────────
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gold,
    paddingVertical: SPACING.md, gap: 8, marginTop: SPACING.md,
  },
  shareBtnText: { color: COLORS.gold, fontWeight: '800', fontSize: 13, letterSpacing: 2 },
});
