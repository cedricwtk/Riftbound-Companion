import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { DOMAIN_COLORS } from '../utils/api';

// ── Type colors for distribution bar ────────────────────────────────────────
const TYPE_COLORS = {
  Unit:      COLORS.riftBright,    // blue
  Spell:     COLORS.arcaneBright,  // purple
  Gear:      COLORS.gold,          // gold
  Champion:  COLORS.win,           // green
};

// ── Compute all deck statistics from a deck object ──────────────────────────
function computeDeckStats(deck) {
  if (!deck?.slots) return null;

  const champion  = deck.slots.champion;
  const runes     = deck.slots.runes || [];
  const main      = deck.slots.main || [];
  const sideboard = deck.slots.sideboard || [];
  const legend    = deck.slots.legend;
  const bfs       = deck.slots.battlefields || [];

  // ── Cost Curve ──
  const costBuckets = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
  const addCost = (card, count = 1) => {
    const c = card?.stats?.cost;
    if (c === undefined || c === null) return;
    const key = c >= 7 ? '7+' : c;
    costBuckets[key] = (costBuckets[key] || 0) + count;
  };
  if (champion) addCost(champion, 1);
  main.forEach(c => addCost(c, c.count));
  sideboard.forEach(c => addCost(c, c.count));

  // ── Power Curve ──
  const powerBuckets = {};
  const addPower = (card, count = 1) => {
    const p = card?.stats?.power;
    if (p === undefined || p === null) return;
    const key = p >= 7 ? '7+' : String(p);
    powerBuckets[key] = (powerBuckets[key] || 0) + count;
  };
  if (champion) addPower(champion, 1);
  main.forEach(c => addPower(c, c.count));

  // ── Summary ──
  let totalCards = 0, totalCost = 0, costN = 0, totalPower = 0, powerN = 0;
  const accum = (card, count = 1) => {
    totalCards += count;
    if (card?.stats?.cost != null) { totalCost += card.stats.cost * count; costN += count; }
    if (card?.stats?.power != null) { totalPower += card.stats.power * count; powerN += count; }
  };
  if (champion) accum(champion, 1);
  main.forEach(c => accum(c, c.count));
  sideboard.forEach(c => accum(c, c.count));

  const avgCost  = costN > 0 ? totalCost / costN : 0;
  const avgPower = powerN > 0 ? totalPower / powerN : 0;

  // ── Type Distribution ──
  const typeCounts = {};
  const addType = (card, count = 1) => {
    if (!card?.type) return;
    typeCounts[card.type] = (typeCounts[card.type] || 0) + count;
  };
  if (champion) addType(champion, 1);
  main.forEach(c => addType(c, c.count));
  sideboard.forEach(c => addType(c, c.count));

  // ── Domain Distribution ──
  const legendDomains = legend?.domains?.length
    ? legend.domains
    : (legend?.domain ? [legend.domain] : []);

  const domainCounts = {};
  const addDomain = (card, count = 1) => {
    if (!card?.domain) return;
    domainCounts[card.domain] = (domainCounts[card.domain] || 0) + count;
  };
  if (champion) addDomain(champion, 1);
  main.forEach(c => addDomain(c, c.count));
  sideboard.forEach(c => addDomain(c, c.count));
  runes.forEach(r => addDomain(r, r.count));

  return {
    costBuckets, powerBuckets,
    totalCards, avgCost, avgPower,
    typeCounts, domainCounts, legendDomains,
  };
}

// ── StatBox ─────────────────────────────────────────────────────────────────
function StatBox({ label, value }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── MiniBarChart ────────────────────────────────────────────────────────────
function MiniBarChart({ buckets, labels, accentColor }) {
  const vals = labels.map(l => buckets[l] || 0);
  const maxVal = Math.max(...vals, 1);

  return (
    <View style={s.chartCard}>
      <View style={s.chartRow}>
        {labels.map((label, i) => {
          const v = vals[i];
          const pct = v / maxVal;
          const isMax = v === maxVal && v > 0;

          return (
            <View key={label} style={s.barCol}>
              {v > 0 && <Text style={s.barCount}>{v}</Text>}
              <View style={s.barTrack}>
                <View style={[
                  s.barFill,
                  {
                    height: `${Math.max(pct * 100, v > 0 ? 5 : 0)}%`,
                    backgroundColor: isMax ? accentColor : COLORS.bgElevated,
                    borderColor: isMax ? accentColor : COLORS.border,
                  },
                ]} />
              </View>
              <Text style={[s.barLabel, isMax && { color: accentColor }]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── SegmentedBar (for type & domain distribution) ───────────────────────────
function SegmentedBar({ data, colorMap }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total   = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  return (
    <View style={s.segCard}>
      {/* Horizontal bar */}
      <View style={s.segBar}>
        {entries.map(([key, count]) => (
          <View
            key={key}
            style={{
              flex: count,
              height: 10,
              backgroundColor: colorMap[key] || COLORS.textMuted,
            }}
          />
        ))}
      </View>
      {/* Legend chips */}
      <View style={s.chipRow}>
        {entries.map(([key, count]) => (
          <View key={key} style={s.chip}>
            <View style={[s.chipDot, { backgroundColor: colorMap[key] || COLORS.textMuted }]} />
            <Text style={s.chipText}>{key}</Text>
            <Text style={s.chipCount}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section label ───────────────────────────────────────────────────────────
function SectionLabel({ text }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

// ── Main Export ─────────────────────────────────────────────────────────────
export default function DeckStatsModal({ visible, deck, onClose }) {
  const stats = deck ? computeDeckStats(deck) : null;
  const isEmpty = !stats || stats.totalCards === 0;

  // Build power labels sorted numerically
  const powerLabels = stats
    ? Object.keys(stats.powerBuckets)
        .sort((a, b) => {
          if (a === '7+') return 1;
          if (b === '7+') return -1;
          return Number(a) - Number(b);
        })
    : [];

  const showDomainSplit = stats && stats.legendDomains.length > 1
    && Object.keys(stats.domainCounts).length > 1;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <SafeAreaView style={s.container}>

          {/* Header */}
          <View style={s.header}>
            <Ionicons name="bar-chart" size={18} color={COLORS.goldLight} />
            <Text style={s.title}>DECK ANALYTICS</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {isEmpty ? (
            /* Empty state */
            <View style={s.emptyWrap}>
              <Ionicons name="analytics-outline" size={48} color={COLORS.textMuted} />
              <Text style={s.emptyText}>Add cards to see deck analytics</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

              {/* Summary row */}
              <View style={s.summaryRow}>
                <StatBox label="CARDS" value={stats.totalCards} />
                <StatBox label="AVG COST" value={stats.avgCost.toFixed(1)} />
                <StatBox label="AVG PWR" value={stats.avgPower.toFixed(1)} />
              </View>

              {/* Energy Curve */}
              <SectionLabel text="ENERGY CURVE" />
              <MiniBarChart
                buckets={stats.costBuckets}
                labels={['0', '1', '2', '3', '4', '5', '6', '7+']}
                accentColor={COLORS.gold}
              />

              {/* Power Curve */}
              {powerLabels.length > 0 && (
                <>
                  <SectionLabel text="POWER DISTRIBUTION" />
                  <MiniBarChart
                    buckets={stats.powerBuckets}
                    labels={powerLabels}
                    accentColor={COLORS.arcaneBright}
                  />
                </>
              )}

              {/* Type Distribution */}
              {Object.keys(stats.typeCounts).length > 0 && (
                <>
                  <SectionLabel text="CARD TYPES" />
                  <SegmentedBar data={stats.typeCounts} colorMap={TYPE_COLORS} />
                </>
              )}

              {/* Domain Split */}
              {showDomainSplit && (
                <>
                  <SectionLabel text="DOMAIN SPLIT" />
                  <SegmentedBar data={stats.domainCounts} colorMap={DOMAIN_COLORS} />
                </>
              )}

            </ScrollView>
          )}

        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const CHART_HEIGHT = 110;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.goldLight,
    letterSpacing: 3,
  },
  scroll: {
    padding: SPACING.md,
    paddingBottom: 60,
    gap: SPACING.sm,
  },

  // ── Empty ──
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },

  // ── Summary ──
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.goldLight,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 2,
  },

  // ── Section Label ──
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginTop: SPACING.md,
  },

  // ── Bar Chart ──
  chartCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 30, // chart + labels
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: CHART_HEIGHT + 30,
  },
  barCount: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  barTrack: {
    flex: 1,
    width: '65%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 3,
    borderWidth: 1,
    minHeight: 0,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 6,
  },

  // ── Segmented Bar ──
  segCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  segBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  chipCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
