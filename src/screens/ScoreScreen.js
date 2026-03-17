import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, ScrollView, Animated, Alert, Vibration, FlatList, Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { fetchCards, DOMAIN_COLORS } from '../utils/api';

// ── Storage ───────────────────────────────────────────────────────────────────
const HISTORY_KEY = 'riftbound_match_history';

const getHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveMatch = async (match) => {
  try {
    const history = await getHistory();
    history.unshift(match);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) { console.error('saveMatch error:', e); }
};

const clearHistory = async () => {}; // managed in MatchHistoryScreen

// ── Point Pips ────────────────────────────────────────────────────────────────
const PointPips = ({ points, max, color, compact }) => {
  const pipSize = compact ? 16 : 24;
  return (
    <View style={[styles.pipsRow, compact && styles.pipsRowCompact]}>
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            { width: pipSize, height: pipSize, borderRadius: pipSize / 2 },
            {
              backgroundColor: i < points ? color : COLORS.pointEmpty,
              borderColor: i < points ? color : COLORS.border,
              shadowColor: i < points ? color : 'transparent',
              shadowOpacity: i < points ? 0.8 : 0,
              shadowRadius: 6,
              elevation: i < points ? 4 : 0,
            },
          ]}
        />
      ))}
    </View>
  );
};

// ── Game Wins Dots (Bo3) ──────────────────────────────────────────────────────
const GameWinDots = ({ wins, total = 2 }) => (
  <View style={styles.gameWinDots}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[styles.gameWinDot, i < wins && styles.gameWinDotFilled]}
      />
    ))}
  </View>
);

// ── Player Card ───────────────────────────────────────────────────────────────
const PlayerCard = ({ player, onAddPoint, onRemovePoint, winPoints, isWinner, gameWins, matchFormat, compact }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleAdd = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.06, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    Vibration.vibrate(30);
    onAddPoint();
  };

  const handleRemove = () => {
    Vibration.vibrate(15);
    onRemovePoint();
  };

  return (
    <Animated.View style={[styles.playerCard, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient
        colors={isWinner ? ['#2A2010', '#1A1506'] : [COLORS.bgCard, COLORS.bg]}
        style={[styles.playerCardGradient, compact && styles.playerCardGradientCompact]}
      >
        {isWinner && (
          <View style={styles.winnerBadge}>
            <Ionicons name="trophy" size={12} color={COLORS.gold} />
            <Text style={styles.winnerText}>WINNER</Text>
          </View>
        )}

        <View style={styles.playerNameRow}>
          <Text style={[styles.playerName, compact && styles.playerNameCompact]}>{player.name}</Text>
          {matchFormat === 'bo3' && (
            <GameWinDots wins={gameWins} total={2} />
          )}
        </View>

        {player.battlefield && (
          <Text style={styles.playerBattlefield}>
            <Ionicons name="map-outline" size={11} color={COLORS.textMuted} /> {player.battlefield}
          </Text>
        )}

        <Text style={[
          styles.pointsLarge,
          compact && styles.pointsLargeCompact,
          { color: isWinner ? COLORS.goldLight : COLORS.textPrimary },
        ]}>
          {player.points}
          <Text style={[styles.pointsMax, compact && styles.pointsMaxCompact]}> / {winPoints}</Text>
        </Text>

        <PointPips
          points={player.points}
          max={winPoints}
          color={isWinner ? COLORS.goldLight : COLORS.arcaneBright}
          compact={compact}
        />

        <View style={[styles.btnRow, compact && styles.btnRowCompact]}>
          <TouchableOpacity
            style={[styles.ptBtn, styles.ptBtnMinus, compact && styles.ptBtnCompact]}
            onPress={handleRemove}
            disabled={player.points <= 0}
          >
            <Ionicons name="remove" size={compact ? 18 : 22} color={player.points > 0 ? COLORS.textSecondary : COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ptBtn, styles.ptBtnPlus, compact && styles.ptBtnCompact, isWinner && styles.ptBtnWin]}
            onPress={handleAdd}
            disabled={isWinner}
          >
            <LinearGradient
              colors={isWinner ? [COLORS.goldDark, COLORS.goldDark] : [COLORS.arcane, COLORS.arcaneBright]}
              style={styles.ptBtnGradient}
            >
              <Ionicons name="add" size={compact ? 22 : 26} color={COLORS.textPrimary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// ── Match History Item ────────────────────────────────────────────────────────
// ── Battlefield Picker ────────────────────────────────────────────────────────
const BattlefieldPicker = ({ visible, onSelect, onClose, currentValue }) => {
  const [battlefields, setBattlefields] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [search, setSearch]             = useState('');

  useEffect(() => {
    if (visible && battlefields.length === 0) {
      setLoading(true);
      fetchCards({ type: 'Battlefield' }).then(res => {
        setBattlefields(res.cards || []);
        setLoading(false);
      });
    }
    if (!visible) setSearch(''); // reset search on close
  }, [visible]);

  const filtered = search.trim()
    ? battlefields.filter(b =>
        b.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : battlefields;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.pickerModal}>

          {/* Header */}
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>SELECT BATTLEFIELD</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.pickerSearchRow}>
            <Ionicons name="search-outline" size={15} color={COLORS.textMuted} />
            <TextInput
              style={styles.pickerSearchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search battlefields..."
              placeholderTextColor={COLORS.textMuted}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <Text style={styles.loadingText}>Loading battlefields...</Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                !search ? (
                  <TouchableOpacity
                    style={[styles.pickerItem, !currentValue && styles.pickerItemActive]}
                    onPress={() => onSelect('')}
                  >
                    <View style={styles.pickerItemNoThumb}>
                      <Ionicons name="ban-outline" size={20} color={COLORS.textMuted} />
                    </View>
                    <View style={styles.pickerItemInfo}>
                      <Text style={styles.pickerItemText}>None</Text>
                      <Text style={styles.pickerItemSub}>No battlefield selected</Text>
                    </View>
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={
                <Text style={styles.loadingText}>No battlefields match "{search}"</Text>
              }
              renderItem={({ item }) => {
                const isActive = currentValue === item.name;
                return (
                  <TouchableOpacity
                    style={[styles.pickerItem, isActive && styles.pickerItemActive]}
                    onPress={() => onSelect(item.name)}
                    activeOpacity={0.75}
                  >
                    {/* Thumbnail */}
                    {item.art?.thumbnailUrl ? (
                      <Image
                        source={{ uri: item.art.thumbnailUrl }}
                        style={styles.pickerThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.pickerThumb, styles.pickerThumbPlaceholder]}>
                        <Ionicons name="map-outline" size={20} color={COLORS.textMuted} />
                      </View>
                    )}

                    {/* Info */}
                    <View style={styles.pickerItemInfo}>
                      <Text
                        style={[styles.pickerItemText, isActive && styles.pickerItemTextActive]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {item.rules?.[0] ? (
                        <Text style={styles.pickerItemSub} numberOfLines={2}>
                          {item.rules[0]}
                        </Text>
                      ) : null}
                    </View>

                    {isActive && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.arcaneBright} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

// ── Legend Picker ─────────────────────────────────────────────────────────────
const LegendPicker = ({ visible, onSelect, onClose, currentValue }) => {
  const [legends, setLegends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    if (!visible || legends.length > 0) return;
    setLoading(true);
    fetchCards({ type: 'Legend' })
      .then(({ cards }) => {
        const filtered = (cards || []).sort((a, b) => {
          const ta = (a.tags?.[0] || a.name).toLowerCase();
          const tb = (b.tags?.[0] || b.name).toLowerCase();
          return ta.localeCompare(tb);
        });
        setLegends(filtered);
      })
      .catch(e => console.error('LegendPicker fetch error:', e))
      .finally(() => setLoading(false));
  }, [visible]);

  const displayed = search.trim()
    ? legends.filter(c => {
        const q = search.trim().toLowerCase();
        const tag = (c.tags?.[0] || '').toLowerCase();   // e.g. "Teemo", "Renata Glasc"
        const name = c.name.toLowerCase();               // e.g. "Swift Scout"
        return tag.includes(q) || name.includes(q);
      })
    : legends;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.legendPickerSafe}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>CHOOSE LEGEND</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.legendSearch}>
          <Ionicons name="search" size={15} color={COLORS.textMuted} />
          <TextInput
            style={styles.legendSearchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search legends…"
            placeholderTextColor={COLORS.textMuted}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.pickerList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <TouchableOpacity
              style={[styles.legendItem, !currentValue && styles.legendItemActive]}
              onPress={() => onSelect(null)}
            >
              <View style={[styles.legendItemIcon, { backgroundColor: COLORS.bgElevated }]}>
                <Ionicons name="close-circle-outline" size={22} color={COLORS.textMuted} />
              </View>
              <Text style={[styles.legendItemName, { color: COLORS.textMuted }]}>No legend</Text>
              {!currentValue && <Ionicons name="checkmark" size={16} color={COLORS.win} />}
            </TouchableOpacity>
          }
          ListEmptyComponent={
            loading ? (
              <Text style={styles.pickerLoading}>Loading legends…</Text>
            ) : (
              <Text style={styles.pickerLoading}>No results for "{search}"</Text>
            )
          }
          renderItem={({ item: card }) => {
            const domains  = card.domains || [];
            const isActive = currentValue?.cardId === card.id;
            const champion = card.tags?.[0] || card.name;
            return (
              <TouchableOpacity
                style={[styles.legendItem, isActive && styles.legendItemActive]}
                onPress={() => onSelect({ cardId: card.id, legendName: champion, cardTitle: card.name, domains, art: card.art?.thumbnailUrl || null })}
              >
                {card.art?.thumbnailUrl ? (
                  <Image source={{ uri: card.art.thumbnailUrl }} style={styles.legendThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.legendThumb, styles.legendThumbPlaceholder]}>
                    <Ionicons name="shield-outline" size={20} color={COLORS.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.legendItemName} numberOfLines={1}>{champion}</Text>
                  <Text style={styles.legendItemSub} numberOfLines={1}>{card.name}</Text>
                  {domains.length > 0 && (
                    <View style={styles.domainPips}>
                      {domains.map(d => (
                        <View key={d} style={[styles.domainPip, { backgroundColor: DOMAIN_COLORS[d] || COLORS.textMuted }]} />
                      ))}
                      <Text style={styles.domainPipText}>{domains.join(' / ')}</Text>
                    </View>
                  )}
                </View>
                {isActive && <Ionicons name="checkmark" size={16} color={COLORS.win} />}
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
};

// ── Match Setup Screen ────────────────────────────────────────────────────────
const MatchSetup = ({ onStart, username }) => {
  const [p1Name, setP1Name] = useState(username || 'Player 1');
  const [p2Name, setP2Name] = useState('Player 2');
  const [p1Battlefield, setP1Battlefield] = useState('');
  const [p2Battlefield, setP2Battlefield] = useState('');
  const [p1Legend, setP1Legend] = useState(null);
  const [p2Legend, setP2Legend] = useState(null);
  const [format, setFormat] = useState('bo1');
  const [winPoints, setWinPoints] = useState(8);
  const [pickingBattlefield, setPickingBattlefield] = useState(null);
  const [pickingLegend, setPickingLegend] = useState(null); // 1 or 2

  return (
    <SafeAreaView style={styles.safe} edges={["top","left","right"]}>
      <ScrollView contentContainerStyle={styles.setupContent}>
        <Text style={styles.setupTitle}>NEW MATCH</Text>

        {/* Format */}
        <Text style={styles.setupSectionLabel}>FORMAT</Text>
        <View style={styles.formatRow}>
          {['bo1', 'bo3'].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.formatChip, format === f && styles.formatChipActive]}
              onPress={() => setFormat(f)}
            >
              <Text style={[styles.formatChipText, format === f && styles.formatChipTextActive]}>
                {f === 'bo1' ? 'Best of 1' : 'Best of 3'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Win condition */}
        <Text style={styles.setupSectionLabel}>WIN CONDITION</Text>
        <View style={styles.winPtsRow}>
          {[7, 8, 9, 10].map(n => (
            <TouchableOpacity
              key={n}
              style={[styles.winPtChip, winPoints === n && styles.winPtChipActive]}
              onPress={() => setWinPoints(n)}
            >
              <Text style={[styles.winPtChipText, winPoints === n && styles.winPtChipTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Players */}
        <Text style={styles.setupSectionLabel}>PLAYERS</Text>

        {/* Player 1 */}
        <View style={styles.playerSetupCard}>
          <Text style={styles.playerSetupLabel}>PLAYER 1</Text>
          <TextInput
            style={styles.setupInput}
            value={p1Name}
            onChangeText={setP1Name}
            placeholder="Player 1 name"
            placeholderTextColor={COLORS.textMuted}
            maxLength={20}
          />
          <TouchableOpacity
            style={styles.battlefieldPickerBtn}
            onPress={() => setPickingBattlefield(1)}
          >
            <Ionicons name="map-outline" size={16} color={COLORS.arcaneBright} />
            <Text style={styles.battlefieldPickerText}>
              {p1Battlefield || 'Select Battlefield (optional)'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.battlefieldPickerBtn, p1Legend && styles.legendPickerBtnActive]}
            onPress={() => setPickingLegend(1)}
          >
            {p1Legend?.art ? (
              <Image source={{ uri: p1Legend.art }} style={styles.legendPickerThumb} resizeMode="cover" />
            ) : (
              <Ionicons name="shield-outline" size={16} color={COLORS.arcaneBright} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.battlefieldPickerText} numberOfLines={1}>
                {p1Legend ? p1Legend.legendName : 'Select Legend (optional)'}
              </Text>
            </View>
            {p1Legend && (
              <TouchableOpacity onPress={() => setP1Legend(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            {!p1Legend && <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />}
          </TouchableOpacity>
          {p1Legend?.domains?.length > 0 && (
            <View style={styles.setupDomainPips}>
              {p1Legend.domains.map(d => (
                <View key={d} style={[styles.domainPip, { backgroundColor: DOMAIN_COLORS[d] || COLORS.textMuted }]} />
              ))}
              <Text style={styles.domainPipText}>{p1Legend.domains.join(' / ')}</Text>
            </View>
          )}
        </View>

        {/* Player 2 */}
        <View style={styles.playerSetupCard}>
          <Text style={styles.playerSetupLabel}>PLAYER 2</Text>
          <TextInput
            style={styles.setupInput}
            value={p2Name}
            onChangeText={setP2Name}
            placeholder="Player 2 name"
            placeholderTextColor={COLORS.textMuted}
            maxLength={20}
          />
          <TouchableOpacity
            style={styles.battlefieldPickerBtn}
            onPress={() => setPickingBattlefield(2)}
          >
            <Ionicons name="map-outline" size={16} color={COLORS.arcaneBright} />
            <Text style={styles.battlefieldPickerText}>
              {p2Battlefield || 'Select Battlefield (optional)'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.battlefieldPickerBtn, p2Legend && styles.legendPickerBtnActive]}
            onPress={() => setPickingLegend(2)}
          >
            {p2Legend?.art ? (
              <Image source={{ uri: p2Legend.art }} style={styles.legendPickerThumb} resizeMode="cover" />
            ) : (
              <Ionicons name="shield-outline" size={16} color={COLORS.arcaneBright} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.battlefieldPickerText} numberOfLines={1}>
                {p2Legend ? p2Legend.legendName : 'Select Legend (optional)'}
              </Text>
            </View>
            {p2Legend && (
              <TouchableOpacity onPress={() => setP2Legend(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            {!p2Legend && <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />}
          </TouchableOpacity>
          {p2Legend?.domains?.length > 0 && (
            <View style={styles.setupDomainPips}>
              {p2Legend.domains.map(d => (
                <View key={d} style={[styles.domainPip, { backgroundColor: DOMAIN_COLORS[d] || COLORS.textMuted }]} />
              ))}
              <Text style={styles.domainPipText}>{p2Legend.domains.join(' / ')}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => onStart({
            players: [
              { id: 1, name: p1Name.trim() || 'Player 1', points: 0, battlefield: p1Battlefield, legend: p1Legend },
              { id: 2, name: p2Name.trim() || 'Player 2', points: 0, battlefield: p2Battlefield, legend: p2Legend },
            ],
            format,
            winPoints,
          })}
        >
          <LinearGradient colors={[COLORS.arcane, COLORS.arcaneBright]} style={styles.startBtnGrad}>
            <Ionicons name="play" size={18} color={COLORS.textPrimary} />
            <Text style={styles.startBtnText}>START MATCH</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <BattlefieldPicker
        visible={pickingBattlefield === 1}
        currentValue={p1Battlefield}
        onSelect={name => { setP1Battlefield(name); setPickingBattlefield(null); }}
        onClose={() => setPickingBattlefield(null)}
      />
      <BattlefieldPicker
        visible={pickingBattlefield === 2}
        currentValue={p2Battlefield}
        onSelect={name => { setP2Battlefield(name); setPickingBattlefield(null); }}
        onClose={() => setPickingBattlefield(null)}
      />
      <LegendPicker
        visible={pickingLegend === 1}
        currentValue={p1Legend}
        onSelect={val => { setP1Legend(val); setPickingLegend(null); }}
        onClose={() => setPickingLegend(null)}
      />
      <LegendPicker
        visible={pickingLegend === 2}
        currentValue={p2Legend}
        onSelect={val => { setP2Legend(val); setPickingLegend(null); }}
        onClose={() => setPickingLegend(null)}
      />
    </SafeAreaView>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ScoreScreen({ username }) {
  const [view, setView] = useState('setup'); // 'setup' | 'game' | 'history'
  const [matchConfig, setMatchConfig] = useState(null);
  const { height: screenHeight } = useWindowDimensions();

  // Game state
  const [players, setPlayers] = useState([]);
  const [round, setRound] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [gameWinner, setGameWinner] = useState(null);
  const [gameWins, setGameWins] = useState({}); // { playerName: winCount }
  const [currentGame, setCurrentGame] = useState(1); // 1, 2, or 3
  const [matchOver, setMatchOver] = useState(false);
  const [matchWinner, setMatchWinner] = useState(null);
  const [gameResults, setGameResults] = useState([]); // array of game result objects

  // Edit name
  const [editingName, setEditingName] = useState(null);
  const [tempName, setTempName] = useState('');

  const loadHistory = async () => {}; // history now lives in MatchHistoryScreen

  const startMatch = (config) => {
    setMatchConfig(config);
    setPlayers(config.players.map(p => ({ ...p, points: 0 })));
    setRound(1);
    setGameOver(false);
    setGameWinner(null);
    setGameWins({});
    setCurrentGame(1);
    setMatchOver(false);
    setMatchWinner(null);
    setGameResults([]);
    setView('game');
  };

  const addPoint = (playerId) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== playerId) return p;
      const newPts = p.points + 1;
      if (newPts >= matchConfig.winPoints) {
        handleGameWin({ ...p, points: newPts });
      }
      return { ...p, points: newPts };
    }));
  };

  const removePoint = (playerId) => {
    if (gameOver) return;
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, points: Math.max(0, p.points - 1) } : p
    ));
  };

  const handleGameWin = (winnerPlayer) => {
    setGameWinner(winnerPlayer);
    setGameOver(true);

    const newGameWins = { ...gameWins };
    newGameWins[winnerPlayer.name] = (newGameWins[winnerPlayer.name] || 0) + 1;
    setGameWins(newGameWins);

    const result = {
      game: currentGame,
      winner: winnerPlayer.name,
      scores: players.map(p => ({
        name: p.name,
        points: p.id === winnerPlayer.id ? winnerPlayer.points : p.points,
        battlefield: p.battlefield || null,
      })),
    };
    const newGameResults = [...gameResults, result];
    setGameResults(newGameResults);

    // Check match winner for Bo3
    if (matchConfig.format === 'bo3') {
      if (newGameWins[winnerPlayer.name] >= 2) {
        finishMatch(winnerPlayer.name, newGameWins, newGameResults);
      }
    } else {
      // Bo1 — match over
      finishMatch(winnerPlayer.name, newGameWins, newGameResults);
    }
  };

  const finishMatch = async (winnerName, finalGameWins, finalGameResults) => {
    setMatchWinner(winnerName);
    setMatchOver(true);

    const match = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      winner: winnerName,
      format: matchConfig.format,
      winPoints: matchConfig.winPoints,
      players: matchConfig.players,
      gameWins: finalGameWins,
      games: finalGameResults,
      totalRounds: round,
    };
    await saveMatch(match);
  };

  const nextGame = () => {
    // Reset points, keep names/battlefields
    setPlayers(prev => prev.map(p => ({ ...p, points: 0 })));
    setRound(1);
    setGameOver(false);
    setGameWinner(null);
    setCurrentGame(g => g + 1);
  };

  const [pickingBFBetween, setPickingBFBetween] = useState(null); // player id 1 or 2

  const resetToSetup = () => {
    setView('setup');
    setMatchConfig(null);
  };

  const startEditName = (player) => {
    setEditingName(player.id);
    setTempName(player.name);
  };

  const saveName = () => {
    if (tempName.trim()) {
      setPlayers(prev => prev.map(p =>
        p.id === editingName ? { ...p, name: tempName.trim() } : p
      ));
    }
    setEditingName(null);
  };

  // ── Setup View ────────────────────────────────────────────────────────────────
  if (view === 'setup') {
    return <MatchSetup onStart={startMatch} username={username} />;
  }

  // ── Game View ─────────────────────────────────────────────────────────────────
  const winsNeeded = matchConfig.format === 'bo3' ? 2 : 1;
  const compact = screenHeight < 700;

  return (
    <SafeAreaView style={styles.safe} edges={["top","left","right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>RIFTBOUND</Text>
          <Text style={styles.headerSub}>
            {matchConfig.format === 'bo3' ? `Game ${currentGame} of 3  ·  ` : ''}
            First to {matchConfig.winPoints}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={resetToSetup}>
            <Ionicons name="close-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bo3 game wins tracker */}
      {matchConfig.format === 'bo3' && (
        <View style={styles.bo3Bar}>
          {players.map(p => (
            <View key={p.id} style={styles.bo3PlayerWins}>
              <Text style={styles.bo3PlayerName} numberOfLines={1}>{p.name}</Text>
              <GameWinDots wins={gameWins[p.name] || 0} total={2} />
            </View>
          ))}
          <Text style={styles.bo3Separator}>WINS</Text>
        </View>
      )}

      {/* Players */}
      <ScrollView
        contentContainerStyle={[styles.playersContainer, compact && styles.playersContainerCompact, { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
      >
        {players.map(player => (
          <View key={player.id} style={{ flex: 1 }}>
            {editingName === player.id ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={tempName}
                  onChangeText={setTempName}
                  onBlur={saveName}
                  onSubmitEditing={saveName}
                  autoFocus
                  maxLength={20}
                />
              </View>
            ) : (
              <TouchableOpacity onPress={() => startEditName(player)} style={styles.nameEditHint}>
                <Ionicons name="pencil-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.nameEditHintText}>tap name to edit</Text>
              </TouchableOpacity>
            )}
            <PlayerCard
              player={player}
              onAddPoint={() => addPoint(player.id)}
              onRemovePoint={() => removePoint(player.id)}
              winPoints={matchConfig.winPoints}
              isWinner={gameWinner?.id === player.id && gameOver}
              gameWins={gameWins[player.name] || 0}
              matchFormat={matchConfig.format}
              compact={compact}
            />
          </View>
        ))}
      </ScrollView>

      {/* Match Over Modal */}
      <Modal visible={matchOver} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#1A1506', '#0A0A0F']} style={styles.gameOverModal}>
            <Ionicons name="trophy" size={48} color={COLORS.gold} />
            <Text style={styles.gameOverTitle}>MATCH WINNER</Text>
            <Text style={styles.gameOverWinner}>{matchWinner}</Text>
            {matchConfig?.format === 'bo3' && (
              <Text style={styles.gameOverSub}>
                {gameWins[matchWinner] || 0} – {gameWins[players.find(p => p.name !== matchWinner)?.name] || 0} in games
              </Text>
            )}
            <Text style={styles.gameOverSaved}>Match saved to history ✓</Text>
            <TouchableOpacity style={styles.newGameBtn} onPress={resetToSetup}>
              <LinearGradient colors={[COLORS.arcane, COLORS.arcaneBright]} style={styles.newGameBtnGrad}>
                <Text style={styles.newGameBtnText}>NEW MATCH</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Game Over (Bo3 only — between games) */}
      <Modal visible={gameOver && !matchOver} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#1A1506', '#0A0A0F']} style={styles.gameOverModal}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.arcaneBright} />
            <Text style={styles.gameOverTitle}>GAME {currentGame}</Text>
            <Text style={styles.gameOverWinner}>{gameWinner?.name}</Text>
            <Text style={styles.gameOverSub}>wins game {currentGame}!</Text>
            <View style={styles.gameScoreRow}>
              {players.map(p => (
                <View key={p.id} style={styles.gameScoreItem}>
                  <Text style={styles.gameScorePlayerName}>{p.name}</Text>
                  <GameWinDots wins={gameWins[p.name] || 0} total={2} />
                </View>
              ))}
            </View>

            {/* Battlefield swap section — only in Bo3 */}
            {matchConfig?.format === 'bo3' && (
              <View style={styles.bfSwapSection}>
                <Text style={styles.bfSwapLabel}>CHANGE BATTLEFIELD?</Text>
                {players.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.bfSwapBtn}
                    onPress={() => setPickingBFBetween(p.id)}
                  >
                    <Ionicons name="map-outline" size={14} color={COLORS.arcaneBright} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bfSwapPlayerName}>{p.name}</Text>
                      <Text style={styles.bfSwapBFName} numberOfLines={1}>
                        {p.battlefield || 'No battlefield'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.newGameBtn} onPress={nextGame}>
              <LinearGradient colors={[COLORS.arcane, COLORS.arcaneBright]} style={styles.newGameBtnGrad}>
                <Text style={styles.newGameBtnText}>GAME {currentGame + 1}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Battlefield picker triggered from between-games modal */}
      <BattlefieldPicker
        visible={pickingBFBetween !== null}
        currentValue={players.find(p => p.id === pickingBFBetween)?.battlefield || ''}
        onSelect={name => {
          setPlayers(prev => prev.map(p => p.id === pickingBFBetween ? { ...p, battlefield: name } : p));
          setPickingBFBetween(null);
        }}
        onClose={() => setPickingBFBetween(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  // Setup
  setupTopBar: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    padding: SPACING.sm, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
  },
  historyBtnText: { fontSize: 12, color: COLORS.textSecondary },

  setupContent: { padding: SPACING.md, paddingBottom: 60 },
  setupTitle: {
    fontSize: 24, fontWeight: '800', color: COLORS.goldLight,
    letterSpacing: 6, marginBottom: SPACING.xl, textAlign: 'center',
  },
  setupSectionLabel: {
    fontSize: 10, color: COLORS.textMuted, letterSpacing: 2,
    marginBottom: SPACING.sm, marginTop: SPACING.md,
  },
  formatRow: { flexDirection: 'row', gap: SPACING.sm },
  formatChip: {
    flex: 1, padding: SPACING.md, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  formatChipActive: { backgroundColor: COLORS.arcane, borderColor: COLORS.arcaneBright },
  formatChipText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  formatChipTextActive: { color: COLORS.textPrimary },

  winPtsRow: { flexDirection: 'row', gap: SPACING.sm },
  winPtChip: {
    flex: 1, padding: SPACING.sm, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  winPtChipActive: { backgroundColor: COLORS.arcane, borderColor: COLORS.arcaneBright },
  winPtChipText: { color: COLORS.textSecondary, fontWeight: '600' },
  winPtChipTextActive: { color: COLORS.textPrimary },

  playerSetupCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.sm, gap: SPACING.sm,
  },
  playerSetupLabel: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  setupInput: {
    backgroundColor: COLORS.bgInput, color: COLORS.textPrimary,
    borderRadius: RADIUS.sm, padding: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, fontSize: 16,
  },
  battlefieldPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgElevated, padding: SPACING.sm,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  battlefieldPickerText: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  legendPickerBtnActive: { borderColor: COLORS.arcaneBright + '80' },
  legendPickerThumb:     { width: 28, height: 36, borderRadius: RADIUS.xs },
  legendPickerSub:       { fontSize: 11, color: COLORS.arcaneBright, marginTop: 1 },
  setupDomainPips:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 2 },
  domainPip:             { width: 8, height: 8, borderRadius: 4 },
  domainPipText:         { fontSize: 11, color: COLORS.textMuted },

  // LegendPicker modal styles
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard, marginBottom: SPACING.sm,
  },
  legendItemActive:  { borderColor: COLORS.win, backgroundColor: COLORS.win + '10' },
  legendItemIcon:    { width: 44, height: 56, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  legendThumb:       { width: 44, height: 56, borderRadius: RADIUS.sm },
  legendThumbPlaceholder: { backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center' },
  legendItemName:    { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  legendItemSub:     { fontSize: 12, color: COLORS.arcaneBright, marginTop: 2 },
  domainPips:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  pickerLoading:     { color: COLORS.textMuted, textAlign: 'center', padding: SPACING.lg },
  legendSearch: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    margin: SPACING.md, marginBottom: 0,
    backgroundColor: COLORS.bgInput, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  legendSearchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
  pickerEmpty:       { alignItems: 'center', padding: SPACING.xxl, gap: SPACING.sm },
  pickerEmptyText:   { fontSize: 16, color: COLORS.textSecondary, fontWeight: '600' },
  pickerEmptyHint:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },

  startBtn: { marginTop: SPACING.xl, borderRadius: RADIUS.md, overflow: 'hidden' },
  startBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, padding: SPACING.lg,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 3 },

  // Game header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 4 },
  headerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, letterSpacing: 1 },
  headerActions: { flexDirection: 'row', gap: SPACING.xs },
  iconBtn: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  // Bo3 bar
  bo3Bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: COLORS.bgCard, padding: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  bo3PlayerWins: { alignItems: 'center', gap: 4 },
  bo3PlayerName: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', maxWidth: 100 },
  bo3Separator: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 2 },
  gameWinDots: { flexDirection: 'row', gap: 6 },
  gameWinDot: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 1.5, borderColor: COLORS.arcaneBright,
    backgroundColor: 'transparent',
  },
  gameWinDotFilled: { backgroundColor: COLORS.arcaneBright },

  // Players
  playersContainer: { padding: SPACING.md, gap: SPACING.md },
  playersContainerCompact: { padding: SPACING.sm, gap: SPACING.sm },
  nameEditHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, paddingLeft: 4 },
  nameEditHintText: { fontSize: 10, color: COLORS.textMuted },
  nameEditRow: { marginBottom: 4 },
  nameInput: {
    backgroundColor: COLORS.bgInput, color: COLORS.textPrimary,
    borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: 16,
    borderWidth: 1, borderColor: COLORS.arcane,
  },

  playerCard: { borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  playerCardGradient: { padding: SPACING.lg },
  playerCardGradientCompact: { padding: SPACING.md, paddingVertical: SPACING.sm },
  winnerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: COLORS.goldDark,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: RADIUS.full, marginBottom: SPACING.sm,
  },
  winnerText: { fontSize: 10, color: COLORS.goldLight, fontWeight: '700', letterSpacing: 2 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  playerName: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  playerNameCompact: { fontSize: 17 },
  playerBattlefield: { fontSize: 11, color: COLORS.textMuted, marginBottom: SPACING.xs },
  pointsLarge: { fontSize: 64, fontWeight: '800', lineHeight: 72 },
  pointsLargeCompact: { fontSize: 42, lineHeight: 48 },
  pointsMax: { fontSize: 28, color: COLORS.textMuted, fontWeight: '400' },
  pointsMaxCompact: { fontSize: 20 },
  pipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: SPACING.md },
  pipsRowCompact: { gap: 4, marginVertical: SPACING.sm },
  pip: { width: 24, height: 24, borderRadius: RADIUS.full, borderWidth: 1.5 },
  btnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  btnRowCompact: { marginTop: SPACING.xs },
  ptBtn: { flex: 1, height: 52, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  ptBtnCompact: { height: 42 },
  ptBtnMinus: { backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border },
  ptBtnPlus: { overflow: 'hidden' },
  ptBtnWin: { opacity: 0.5 },
  ptBtnGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

  // Battlefield picker
  pickerModal: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    maxHeight: '85%', width: '100%',
    borderWidth: 1, borderColor: COLORS.border,
  },
  legendPickerSafe: {
    flex: 1, backgroundColor: COLORS.bg,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pickerTitle: { fontSize: 13, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 3 },
  pickerSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    margin: SPACING.sm, paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  pickerSearchInput: {
    flex: 1, color: COLORS.textPrimary, fontSize: 14,
    paddingVertical: 10,
  },
  pickerList: { padding: SPACING.md, paddingBottom: 40 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pickerItemActive: { backgroundColor: COLORS.arcane + '30' },
  pickerThumb: {
    width: 72, height: 52, borderRadius: RADIUS.sm, overflow: 'hidden',
  },
  pickerThumbPlaceholder: {
    backgroundColor: COLORS.bgElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  pickerItemNoThumb: {
    width: 72, height: 52, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgElevated,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  pickerItemInfo: { flex: 1 },
  pickerItemText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  pickerItemTextActive: { color: COLORS.arcaneBright },
  pickerItemSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, lineHeight: 15 },
  loadingText: { padding: SPACING.xl, textAlign: 'center', color: COLORS.textMuted },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.lg,
  },
  gameOverModal: {
    width: '100%', borderRadius: RADIUS.lg, padding: SPACING.xxl,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.goldDark,
  },
  gameOverTitle: {
    fontSize: 14, fontWeight: '800', color: COLORS.goldLight,
    letterSpacing: 8, marginTop: SPACING.md,
  },
  gameOverWinner: { fontSize: 36, fontWeight: '800', color: COLORS.textPrimary, marginTop: SPACING.xs },
  gameOverSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm },

  bfSwapSection: {
    width: '100%', marginTop: SPACING.md, marginBottom: SPACING.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: SPACING.md, gap: SPACING.xs,
  },
  bfSwapLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 2, marginBottom: SPACING.xs,
  },
  bfSwapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: RADIUS.sm,
    padding: SPACING.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  bfSwapPlayerName: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  bfSwapBFName:     { fontSize: 13, color: COLORS.textPrimary, fontWeight: '700' },
  gameOverSaved: { fontSize: 12, color: COLORS.win || '#4CAF50', marginTop: SPACING.sm, marginBottom: SPACING.lg },
  gameScoreRow: { flexDirection: 'row', gap: SPACING.xl, marginVertical: SPACING.lg },
  gameScoreItem: { alignItems: 'center', gap: SPACING.xs },
  gameScorePlayerName: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  newGameBtn: { width: '100%', borderRadius: RADIUS.md, overflow: 'hidden' },
  newGameBtnGrad: { padding: SPACING.md, alignItems: 'center' },
  newGameBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 3 },

  // History
  historyList: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },
  historyItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard, padding: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  historyLeft: { flex: 1, gap: 3 },
  historyWinnerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  historyWinner: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  formatBadge: {
    backgroundColor: COLORS.arcane + '40', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.arcaneBright + '60',
  },
  formatBadgeText: { fontSize: 9, color: COLORS.arcaneBright, fontWeight: '700' },
  historyMatchup: { fontSize: 12, color: COLORS.textMuted },
  historyBattlefields: { fontSize: 11, color: COLORS.textMuted },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyScore: { fontSize: 18, fontWeight: '800', color: COLORS.arcaneBright },
  historyDate: { fontSize: 11, color: COLORS.textMuted },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyTitle: { fontSize: 18, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center' },
});
