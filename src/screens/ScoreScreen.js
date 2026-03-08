import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, ScrollView, Animated, Alert, Vibration
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { saveGame } from '../utils/storage';

const MAX_POINTS = 8; // default, configurable

// ── Point pip row ──────────────────────────────────────────────────────────
const PointPips = ({ points, max, color }) => {
  return (
    <View style={styles.pipsRow}>
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
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

// ── Player card ─────────────────────────────────────────────────────────────
const PlayerCard = ({ player, onAddPoint, onRemovePoint, winPoints, isWinner }) => {
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
        style={styles.playerCardGradient}
      >
        {isWinner && (
          <View style={styles.winnerBadge}>
            <Ionicons name="trophy" size={12} color={COLORS.gold} />
            <Text style={styles.winnerText}>WINNER</Text>
          </View>
        )}

        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={[styles.pointsLarge, { color: isWinner ? COLORS.goldLight : COLORS.textPrimary }]}>
          {player.points}
          <Text style={styles.pointsMax}> / {winPoints}</Text>
        </Text>

        <PointPips
          points={player.points}
          max={winPoints}
          color={isWinner ? COLORS.goldLight : COLORS.arcaneBright}
        />

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.ptBtn, styles.ptBtnMinus]}
            onPress={handleRemove}
            disabled={player.points <= 0}
          >
            <Ionicons name="remove" size={22} color={player.points > 0 ? COLORS.textSecondary : COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ptBtn, styles.ptBtnPlus, isWinner && styles.ptBtnWin]}
            onPress={handleAdd}
            disabled={isWinner}
          >
            <LinearGradient
              colors={isWinner ? [COLORS.goldDark, COLORS.goldDark] : [COLORS.arcane, COLORS.arcaneBright]}
              style={styles.ptBtnGradient}
            >
              <Ionicons name="add" size={26} color={COLORS.textPrimary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function ScoreScreen() {
  const [winPoints, setWinPoints] = useState(MAX_POINTS);
  const [round, setRound] = useState(1);
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player 1', points: 0 },
    { id: 2, name: 'Player 2', points: 0 },
  ]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editingName, setEditingName] = useState(null);
  const [tempName, setTempName] = useState('');
  const [tempWinPoints, setTempWinPoints] = useState('8');

  const addPoint = (playerId) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== playerId) return p;
      const newPts = p.points + 1;
      if (newPts >= winPoints) {
        setWinner({ ...p, points: newPts });
        setGameOver(true);
        handleSaveGame({ ...p, points: newPts });
      }
      return { ...p, points: newPts };
    }));
  };

  const removePoint = (playerId) => {
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, points: Math.max(0, p.points - 1) } : p
    ));
  };

  const handleSaveGame = async (winnerPlayer) => {
    await saveGame({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      winner: winnerPlayer.name,
      players: players.map(p => ({ name: p.name, points: p.id === winnerPlayer.id ? winnerPlayer.points : p.points })),
      rounds: round,
      winPoints,
    });
  };

  const resetGame = () => {
    setPlayers(prev => prev.map(p => ({ ...p, points: 0 })));
    setRound(1);
    setGameOver(false);
    setWinner(null);
  };

  const applySettings = () => {
    const pts = parseInt(tempWinPoints);
    if (pts >= 1 && pts <= 20) setWinPoints(pts);
    setSettingsVisible(false);
    resetGame();
  };

  const openSettings = () => {
    setTempWinPoints(String(winPoints));
    setSettingsVisible(true);
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

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>RIFTBOUND</Text>
          <Text style={styles.headerSub}>Round {round} · First to {winPoints}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setRound(r => r + 1)}>
            <Ionicons name="arrow-forward-circle-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={openSettings}>
            <Ionicons name="settings-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={resetGame}>
            <Ionicons name="refresh-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Players */}
      <ScrollView contentContainerStyle={styles.playersContainer} showsVerticalScrollIndicator={false}>
        {players.map(player => (
          <View key={player.id}>
            {/* Tap name to edit */}
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
              winPoints={winPoints}
              isWinner={winner?.id === player.id && gameOver}
            />
          </View>
        ))}
      </ScrollView>

      {/* Game Over Modal */}
      <Modal visible={gameOver} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#1A1506', '#0A0A0F']} style={styles.gameOverModal}>
            <Ionicons name="trophy" size={48} color={COLORS.gold} />
            <Text style={styles.gameOverTitle}>VICTORY</Text>
            <Text style={styles.gameOverWinner}>{winner?.name}</Text>
            <Text style={styles.gameOverSub}>reached {winPoints} points in {round} round{round !== 1 ? 's' : ''}</Text>
            <TouchableOpacity style={styles.newGameBtn} onPress={resetGame}>
              <LinearGradient colors={[COLORS.arcane, COLORS.arcaneBright]} style={styles.newGameBtnGrad}>
                <Text style={styles.newGameBtnText}>NEW GAME</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.settingsTitle}>GAME SETTINGS</Text>

            <Text style={styles.settingsLabel}>Win Condition (points)</Text>
            <View style={styles.winPtsRow}>
              {[7, 8, 9, 10].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.winPtChip, tempWinPoints === String(n) && styles.winPtChipActive]}
                  onPress={() => setTempWinPoints(String(n))}
                >
                  <Text style={[styles.winPtChipText, tempWinPoints === String(n) && styles.winPtChipTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.settingsLabel}>Or enter custom:</Text>
            <TextInput
              style={styles.settingsInput}
              value={tempWinPoints}
              onChangeText={setTempWinPoints}
              keyboardType="numeric"
              maxLength={2}
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.settingsNote}>
              ⚠ Changing settings will reset the current game.
            </Text>

            <View style={styles.settingsBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettingsVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applySettings}>
                <Text style={styles.applyBtnText}>Apply</Text>
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18, fontWeight: '800', color: COLORS.goldLight,
    letterSpacing: 4,
  },
  headerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, letterSpacing: 1 },
  headerActions: { flexDirection: 'row', gap: SPACING.xs },
  iconBtn: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  playersContainer: { padding: SPACING.md, gap: SPACING.md },

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

  winnerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: COLORS.goldDark,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: RADIUS.full, marginBottom: SPACING.sm,
  },
  winnerText: { fontSize: 10, color: COLORS.goldLight, fontWeight: '700', letterSpacing: 2 },

  playerName: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  pointsLarge: { fontSize: 64, fontWeight: '800', lineHeight: 72 },
  pointsMax: { fontSize: 28, color: COLORS.textMuted, fontWeight: '400' },

  pipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: SPACING.md },
  pip: {
    width: 24, height: 24, borderRadius: RADIUS.full,
    borderWidth: 1.5,
  },

  btnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  ptBtn: {
    flex: 1, height: 52, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  ptBtnMinus: { backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border },
  ptBtnPlus: { overflow: 'hidden' },
  ptBtnWin: { opacity: 0.5 },
  ptBtnGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

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
  gameOverSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm, marginBottom: SPACING.xl },
  newGameBtn: { width: '100%', borderRadius: RADIUS.md, overflow: 'hidden' },
  newGameBtnGrad: { padding: SPACING.md, alignItems: 'center' },
  newGameBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 3 },

  settingsModal: {
    width: '100%', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  settingsTitle: {
    fontSize: 14, fontWeight: '800', color: COLORS.goldLight,
    letterSpacing: 4, marginBottom: SPACING.lg,
  },
  settingsLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.sm, letterSpacing: 1 },
  winPtsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  winPtChip: {
    flex: 1, padding: SPACING.sm, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgElevated, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  winPtChipActive: { backgroundColor: COLORS.arcane, borderColor: COLORS.arcaneBright },
  winPtChipText: { color: COLORS.textSecondary, fontWeight: '600' },
  winPtChipTextActive: { color: COLORS.textPrimary },
  settingsInput: {
    backgroundColor: COLORS.bgInput, color: COLORS.textPrimary,
    borderRadius: RADIUS.sm, padding: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
    fontSize: 16, marginBottom: SPACING.sm,
  },
  settingsNote: { fontSize: 11, color: COLORS.textMuted, marginBottom: SPACING.lg },
  settingsBtns: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: {
    flex: 1, padding: SPACING.md, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgElevated, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  applyBtn: {
    flex: 1, padding: SPACING.md, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.arcane, alignItems: 'center',
  },
  applyBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
});
