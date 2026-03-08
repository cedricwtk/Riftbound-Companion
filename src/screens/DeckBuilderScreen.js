import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { getDecks, saveDeck, deleteDeck } from '../utils/storage';
import CardsScreen from './CardsScreen';
import { DOMAIN_COLORS } from '../utils/api';

const MAX_DECK_SIZE = 40;

// ── Deck Stats ───────────────────────────────────────────────────────────────
const DeckStats = ({ cards }) => {
  const total = cards.reduce((sum, c) => sum + c.count, 0);
  const typeCounts = cards.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + c.count;
    return acc;
  }, {});
  const domainCounts = cards.reduce((acc, c) => {
    acc[c.domain] = (acc[c.domain] || 0) + c.count;
    return acc;
  }, {});
  const costCurve = cards.reduce((acc, c) => {
    const cost = c.stats?.cost ?? '?';
    acc[cost] = (acc[cost] || 0) + c.count;
    return acc;
  }, {});
  const maxCurveVal = Math.max(...Object.values(costCurve), 1);

  return (
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>DECK STATS</Text>
      <Text style={styles.statsTotalText}>{total} / {MAX_DECK_SIZE} cards</Text>

      {/* Type breakdown */}
      <Text style={styles.statsSubtitle}>BY TYPE</Text>
      <View style={styles.statsChips}>
        {Object.entries(typeCounts).map(([type, count]) => (
          <View key={type} style={styles.typeChip}>
            <Text style={styles.typeChipLabel}>{type}</Text>
            <Text style={styles.typeChipCount}>{count}</Text>
          </View>
        ))}
      </View>

      {/* Domain breakdown */}
      <Text style={styles.statsSubtitle}>BY DOMAIN</Text>
      <View style={styles.statsChips}>
        {Object.entries(domainCounts).map(([domain, count]) => (
          <View key={domain} style={[styles.domainChip, { borderColor: DOMAIN_COLORS[domain] || COLORS.border }]}>
            <View style={[styles.domainDot, { backgroundColor: DOMAIN_COLORS[domain] || COLORS.textMuted }]} />
            <Text style={styles.typeChipLabel}>{domain}</Text>
            <Text style={[styles.typeChipCount, { color: DOMAIN_COLORS[domain] || COLORS.textPrimary }]}>{count}</Text>
          </View>
        ))}
      </View>

      {/* Cost curve */}
      {Object.keys(costCurve).length > 0 && (
        <>
          <Text style={styles.statsSubtitle}>COST CURVE</Text>
          <View style={styles.curveRow}>
            {Object.entries(costCurve).sort((a, b) => Number(a[0]) - Number(b[0])).map(([cost, count]) => (
              <View key={cost} style={styles.curveBar}>
                <Text style={styles.curveCount}>{count}</Text>
                <View style={[styles.curveBarFill, { height: Math.max(8, (count / maxCurveVal) * 60) }]} />
                <Text style={styles.curveCost}>{cost}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

// ── Deck Card Item ───────────────────────────────────────────────────────────
const DeckCardItem = ({ item, onAdd, onRemove }) => (
  <View style={styles.deckCardItem}>
    <View style={[styles.deckCardDot, { backgroundColor: DOMAIN_COLORS[item.domain] || COLORS.textMuted }]} />
    <Text style={styles.deckCardName} numberOfLines={1}>{item.name}</Text>
    <Text style={styles.deckCardType}>{item.type}</Text>
    <View style={styles.countControls}>
      <TouchableOpacity onPress={() => onRemove(item)} style={styles.countBtn}>
        <Ionicons name="remove" size={14} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.countText}>{item.count}</Text>
      <TouchableOpacity onPress={() => onAdd(item)} style={styles.countBtn}>
        <Ionicons name="add" size={14} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  </View>
);

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function DeckBuilderScreen() {
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [newDeckModal, setNewDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => { loadDecks(); }, []);

  const loadDecks = async () => {
    const d = await getDecks();
    setDecks(d);
  };

  const createDeck = async () => {
    if (!newDeckName.trim()) return;
    const deck = {
      id: Date.now().toString(),
      name: newDeckName.trim(),
      cards: [],
      createdAt: new Date().toISOString(),
    };
    await saveDeck(deck);
    await loadDecks();
    setSelectedDeck(deck);
    setNewDeckModal(false);
    setNewDeckName('');
  };

  const handleDeleteDeck = (deck) => {
    Alert.alert('Delete Deck', `Delete "${deck.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteDeck(deck.id);
          if (selectedDeck?.id === deck.id) setSelectedDeck(null);
          await loadDecks();
        }
      }
    ]);
  };

  const addCardToDeck = async (card) => {
    if (!selectedDeck) return;
    const existing = selectedDeck.cards.find(c => c.id === card.id);
    const totalCount = selectedDeck.cards.reduce((sum, c) => sum + c.count, 0);
    if (totalCount >= MAX_DECK_SIZE) {
      Alert.alert('Deck Full', `Maximum ${MAX_DECK_SIZE} cards allowed.`);
      return;
    }
    let updatedCards;
    if (existing) {
      updatedCards = selectedDeck.cards.map(c =>
        c.id === card.id ? { ...c, count: c.count + 1 } : c
      );
    } else {
      updatedCards = [...selectedDeck.cards, { ...card, count: 1 }];
    }
    const updated = { ...selectedDeck, cards: updatedCards };
    setSelectedDeck(updated);
    await saveDeck(updated);
    await loadDecks();
    setBrowsing(false);
  };

  const removeCardFromDeck = async (card) => {
    if (!selectedDeck) return;
    let updatedCards = selectedDeck.cards
      .map(c => c.id === card.id ? { ...c, count: c.count - 1 } : c)
      .filter(c => c.count > 0);
    const updated = { ...selectedDeck, cards: updatedCards };
    setSelectedDeck(updated);
    await saveDeck(updated);
    await loadDecks();
  };

  const shareDeck = async () => {
    if (!selectedDeck) return;
    const lines = [
      `=== ${selectedDeck.name} ===`,
      `Total: ${selectedDeck.cards.reduce((s, c) => s + c.count, 0)} cards`,
      '',
      ...selectedDeck.cards.map(c => `${c.count}x ${c.name} (${c.type} - ${c.domain})`),
      '',
      'Built with Riftbound Companion App'
    ];
    await Share.share({ message: lines.join('\n'), title: selectedDeck.name });
  };

  // Browsing cards to add
  if (browsing) {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.browseHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setBrowsing(false)}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
            <Text style={styles.backBtnText}>Back to Deck</Text>
          </TouchableOpacity>
          <Text style={styles.browseHint}>Tap a card then "Add to Deck"</Text>
        </View>
        <CardsScreen onAddToDeck={addCardToDeck} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Deck list or builder */}
      {!selectedDeck ? (
        <View style={styles.deckList}>
          <View style={styles.deckListHeader}>
            <Text style={styles.screenTitle}>MY DECKS</Text>
            <TouchableOpacity style={styles.newDeckBtn} onPress={() => setNewDeckModal(true)}>
              <Ionicons name="add" size={18} color={COLORS.textPrimary} />
              <Text style={styles.newDeckBtnText}>New Deck</Text>
            </TouchableOpacity>
          </View>

          {decks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Decks Yet</Text>
              <Text style={styles.emptySubtitle}>Create your first deck to get started</Text>
              <TouchableOpacity style={styles.emptyCreateBtn} onPress={() => setNewDeckModal(true)}>
                <Text style={styles.emptyCreateBtnText}>Create Deck</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={decks}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.deckListContent}
              renderItem={({ item }) => {
                const total = item.cards.reduce((s, c) => s + c.count, 0);
                return (
                  <TouchableOpacity style={styles.deckCard} onPress={() => setSelectedDeck(item)}>
                    <LinearGradient colors={[COLORS.bgCard, COLORS.bg]} style={styles.deckCardGrad}>
                      <View style={styles.deckCardInfo}>
                        <Text style={styles.deckCardName}>{item.name}</Text>
                        <Text style={styles.deckCardCount}>{total} cards</Text>
                      </View>
                      <View style={styles.deckCardActions}>
                        <TouchableOpacity onPress={() => handleDeleteDeck(item)} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                        </TouchableOpacity>
                        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Deck builder header */}
          <View style={styles.builderHeader}>
            <TouchableOpacity onPress={() => setSelectedDeck(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.builderDeckName} numberOfLines={1}>{selectedDeck.name}</Text>
            <View style={styles.builderActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowStats(v => !v)}>
                <Ionicons name="bar-chart-outline" size={18} color={showStats ? COLORS.goldLight : COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={shareDeck}>
                <Ionicons name="share-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {showStats && selectedDeck.cards.length > 0 && (
            <DeckStats cards={selectedDeck.cards} />
          )}

          <FlatList
            data={selectedDeck.cards}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.deckCardList}
            ListEmptyComponent={
              <View style={styles.emptyDeck}>
                <Text style={styles.emptyDeckText}>No cards yet. Add cards to build your deck!</Text>
              </View>
            }
            renderItem={({ item }) => (
              <DeckCardItem
                item={item}
                onAdd={addCardToDeck}
                onRemove={removeCardFromDeck}
              />
            )}
          />

          <View style={styles.builderFooter}>
            <Text style={styles.footerCount}>
              {selectedDeck.cards.reduce((s, c) => s + c.count, 0)} / {MAX_DECK_SIZE} cards
            </Text>
            <TouchableOpacity style={styles.addCardsBtn} onPress={() => setBrowsing(true)}>
              <LinearGradient colors={[COLORS.arcane, COLORS.arcaneBright]} style={styles.addCardsBtnGrad}>
                <Ionicons name="add" size={18} color={COLORS.textPrimary} />
                <Text style={styles.addCardsBtnText}>Add Cards</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* New Deck Modal */}
      <Modal visible={newDeckModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.newDeckModal}>
            <Text style={styles.newDeckModalTitle}>NEW DECK</Text>
            <TextInput
              style={styles.newDeckInput}
              placeholder="Deck name..."
              placeholderTextColor={COLORS.textMuted}
              value={newDeckName}
              onChangeText={setNewDeckName}
              autoFocus
              maxLength={40}
            />
            <View style={styles.newDeckBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setNewDeckModal(false); setNewDeckName(''); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.createBtn, !newDeckName.trim() && { opacity: 0.4 }]} onPress={createDeck} disabled={!newDeckName.trim()}>
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  screenTitle: { fontSize: 16, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 4 },

  deckList: { flex: 1 },
  deckListHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  newDeckBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.arcane, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  newDeckBtnText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 },
  deckListContent: { padding: SPACING.md, gap: SPACING.sm },

  deckCard: { borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  deckCardGrad: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md,
  },
  deckCardInfo: {},
  deckCardName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  deckCardCount: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  deckCardActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  deleteBtn: { padding: SPACING.xs },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
  emptyTitle: { fontSize: 18, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center' },
  emptyCreateBtn: {
    marginTop: SPACING.lg, backgroundColor: COLORS.arcane,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
  },
  emptyCreateBtnText: { color: COLORS.textPrimary, fontWeight: '700' },

  // Builder
  builderHeader: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  backBtnText: { color: COLORS.textPrimary, fontSize: 15 },
  builderDeckName: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  builderActions: { flexDirection: 'row', gap: SPACING.xs },
  iconBtn: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  statsCard: {
    margin: SPACING.md, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statsTitle: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 2, marginBottom: SPACING.xs },
  statsTotalText: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  statsSubtitle: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 2, marginBottom: SPACING.xs, marginTop: SPACING.sm },
  statsChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.bgElevated, paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
  },
  typeChipLabel: { fontSize: 11, color: COLORS.textSecondary },
  typeChipCount: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '700' },
  domainChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.bgElevated, paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  domainDot: { width: 6, height: 6, borderRadius: 3 },
  curveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80, marginTop: SPACING.xs },
  curveBar: { flex: 1, alignItems: 'center' },
  curveCount: { fontSize: 9, color: COLORS.textMuted, marginBottom: 2 },
  curveBarFill: { width: '100%', backgroundColor: COLORS.arcane, borderRadius: 2 },
  curveCost: { fontSize: 9, color: COLORS.textMuted, marginTop: 2 },

  deckCardList: { padding: SPACING.md, gap: SPACING.xs, paddingBottom: 100 },
  deckCardItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, padding: SPACING.sm,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  deckCardDot: { width: 8, height: 8, borderRadius: 4 },
  deckCardName: { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  deckCardType: { fontSize: 11, color: COLORS.textMuted },
  countControls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  countBtn: {
    width: 24, height: 24, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center',
  },
  countText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '700', minWidth: 20, textAlign: 'center' },

  emptyDeck: { padding: SPACING.xl, alignItems: 'center' },
  emptyDeckText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },

  builderFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  footerCount: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  addCardsBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  addCardsBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  addCardsBtnText: { color: COLORS.textPrimary, fontWeight: '700' },

  // Browse header
  browseHeader: {
    backgroundColor: COLORS.bgCard, padding: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  browseHint: { fontSize: 11, color: COLORS.textMuted },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: SPACING.lg },
  newDeckModal: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  newDeckModalTitle: { fontSize: 14, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 4, marginBottom: SPACING.md },
  newDeckInput: {
    backgroundColor: COLORS.bgInput, color: COLORS.textPrimary,
    borderRadius: RADIUS.sm, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, fontSize: 16, marginBottom: SPACING.md,
  },
  newDeckBtns: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: {
    flex: 1, padding: SPACING.md, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgElevated, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  createBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.sm, backgroundColor: COLORS.arcane, alignItems: 'center' },
  createBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
});
