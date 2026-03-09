import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Image, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { DOMAIN_COLORS } from '../utils/api';
import { isPremium } from '../utils/storage';
import PremiumGate from '../components/PremiumGate';

const HISTORY_KEY = 'riftbound_match_history';

const getHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const clearHistory = async () => {
  await AsyncStorage.removeItem(HISTORY_KEY);
};

// ── Win/Loss colors ───────────────────────────────────────────────────────────
const WIN_GRADIENT  = ['#0D2B1A', '#081A10'];
const LOSS_GRADIENT = ['#2B0D0D', '#1A0808'];
const WIN_BORDER    = '#2A6B42';
const LOSS_BORDER   = '#6B2A2A';
const WIN_ACCENT    = '#4CAF50';
const LOSS_ACCENT   = '#E05252';

// ── Match Detail Modal ────────────────────────────────────────────────────────
const MatchDetailModal = ({ match, visible, onClose }) => {
  if (!match) return null;

  const player1 = match.players?.[0];
  const player2 = match.players?.[1];
  const isWin   = match.winner === player1?.name;
  const isBo3   = match.format === 'bo3';
  const accent  = isWin ? WIN_ACCENT : LOSS_ACCENT;
  const p1Wins  = match.gameWins?.[player1?.name] || 0;
  const p2Wins  = match.gameWins?.[player2?.name] || 0;

  const date    = new Date(match.date);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const LegendChip = ({ legend, align = 'left' }) => {
    if (!legend) return null;
    return (
      <View style={[styles.detailLegendChip, align === 'right' && { flexDirection: 'row-reverse' }]}>
        {legend.art ? (
          <Image source={{ uri: legend.art }} style={styles.detailLegendThumb} resizeMode="cover" />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.detailLegendName, { textAlign: align }]} numberOfLines={1}>
            {legend.legendName}
          </Text>
          {legend.domains?.length > 0 && (
            <View style={[styles.detailLegendDomains, align === 'right' && { justifyContent: 'flex-end' }]}>
              {legend.domains.map(d => (
                <View key={d} style={[styles.detailDomainDot, { backgroundColor: DOMAIN_COLORS[d] || COLORS.textMuted }]} />
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.detailOverlay}>
        <View style={styles.detailModal}>

          {/* Handle bar */}
          <View style={styles.detailHandle} />

          {/* Header */}
          <LinearGradient
            colors={isWin ? WIN_GRADIENT : LOSS_GRADIENT}
            style={styles.detailHeader}
          >
            <View style={[styles.detailResultBadge, { backgroundColor: accent + '25', borderColor: accent }]}>
              <Ionicons name={isWin ? 'trophy' : 'close-circle'} size={13} color={accent} />
              <Text style={[styles.detailResultText, { color: accent }]}>
                {isWin ? 'VICTORY' : 'DEFEAT'}
              </Text>
            </View>
            <Text style={styles.detailDate}>{dateStr}</Text>
            <Text style={styles.detailTime}>{timeStr}</Text>
            {isBo3 && (
              <Text style={[styles.detailScore, { color: accent }]}>
                {p1Wins} – {p2Wins}  <Text style={styles.detailScoreSub}>in games</Text>
              </Text>
            )}
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>

            {/* Players overview */}
            <View style={styles.detailPlayersRow}>
              {/* You */}
              <View style={styles.detailPlayerCol}>
                <Text style={[styles.detailPlayerLabel, { color: accent }]}>YOU</Text>
                <Text style={[styles.detailPlayerName, { color: accent }]} numberOfLines={1}>{player1?.name}</Text>
                <LegendChip legend={player1?.legend} align="left" />
                {!isBo3 && player1?.battlefield ? (
                  <View style={styles.detailBFChip}>
                    <Ionicons name="map-outline" size={11} color={COLORS.textMuted} />
                    <Text style={styles.detailBFText} numberOfLines={2}>{player1.battlefield}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.detailVs}>VS</Text>

              {/* Opponent */}
              <View style={[styles.detailPlayerCol, { alignItems: 'flex-end' }]}>
                <Text style={styles.detailPlayerLabel}>OPP</Text>
                <Text style={styles.detailPlayerName} numberOfLines={1}>{player2?.name}</Text>
                <LegendChip legend={player2?.legend} align="right" />
                {!isBo3 && player2?.battlefield ? (
                  <View style={[styles.detailBFChip, { flexDirection: 'row-reverse' }]}>
                    <Ionicons name="map-outline" size={11} color={COLORS.textMuted} />
                    <Text style={[styles.detailBFText, { textAlign: 'right' }]} numberOfLines={2}>{player2.battlefield}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Games breakdown — Bo3 */}
            {isBo3 && match.games?.length > 0 && (
              <View style={styles.detailGamesSection}>
                <Text style={styles.detailSectionTitle}>GAMES</Text>
                {match.games.map((game, idx) => {
                  const gP1    = game.scores?.find(s => s.name === player1?.name);
                  const gP2    = game.scores?.find(s => s.name === player2?.name);
                  const gIsWin = game.winner === player1?.name;
                  const gAccent = gIsWin ? WIN_ACCENT : LOSS_ACCENT;
                  return (
                    <View key={idx} style={[styles.detailGameRow, { borderColor: gAccent + '40' }]}>
                      {/* Game number + result */}
                      <View style={[styles.detailGameBadge, { backgroundColor: gAccent + '20', borderColor: gAccent }]}>
                        <Text style={[styles.detailGameNum, { color: gAccent }]}>G{game.game}</Text>
                        <Ionicons name={gIsWin ? 'trophy' : 'close-circle'} size={11} color={gAccent} />
                      </View>

                      {/* P1 side */}
                      <View style={styles.detailGamePlayer}>
                        <Text style={[styles.detailGamePoints, { color: gIsWin ? WIN_ACCENT : COLORS.textPrimary }]}>
                          {gP1?.points ?? '–'}
                        </Text>
                        {gP1?.battlefield ? (
                          <View style={styles.detailGameBF}>
                            <Ionicons name="map-outline" size={10} color={COLORS.textMuted} />
                            <Text style={styles.detailGameBFText} numberOfLines={1}>{gP1.battlefield}</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.detailGameDash}>–</Text>

                      {/* P2 side */}
                      <View style={[styles.detailGamePlayer, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.detailGamePoints, { color: !gIsWin ? LOSS_ACCENT : COLORS.textPrimary }]}>
                          {gP2?.points ?? '–'}
                        </Text>
                        {gP2?.battlefield ? (
                          <View style={[styles.detailGameBF, { flexDirection: 'row-reverse' }]}>
                            <Ionicons name="map-outline" size={10} color={COLORS.textMuted} />
                            <Text style={[styles.detailGameBFText, { textAlign: 'right' }]} numberOfLines={1}>{gP2.battlefield}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Match meta */}
            <View style={styles.detailMeta}>
              <Text style={styles.detailMetaText}>
                {isBo3 ? 'Best of 3' : 'Best of 1'}  ·  Win at {match.winPoints} pts  ·  {match.totalRounds} rounds
              </Text>
            </View>

          </ScrollView>

          {/* Close button */}
          <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose}>
            <Text style={styles.detailCloseBtnText}>CLOSE</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
};

// ── Match Card ────────────────────────────────────────────────────────────────
const MatchCard = ({ match, onPress }) => {
  // Player 1 is always the app user
  const player1 = match.players?.[0];
  const player2 = match.players?.[1];
  const isWin = match.winner === player1?.name;

  const accent      = isWin ? WIN_ACCENT  : LOSS_ACCENT;
  const borderColor = isWin ? WIN_BORDER  : LOSS_BORDER;
  const gradient    = isWin ? WIN_GRADIENT : LOSS_GRADIENT;

  const date = new Date(match.date);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Scores per game (for Bo3)
  const isBo3 = match.format === 'bo3';
  const p1Wins = match.gameWins?.[player1?.name] || 0;
  const p2Wins = match.gameWins?.[player2?.name] || 0;

  // Final points from last game or only game
  const lastGame = match.games?.[match.games.length - 1];
  const p1FinalPts = lastGame?.scores?.find(s => s.name === player1?.name)?.points ?? '–';
  const p2FinalPts = lastGame?.scores?.find(s => s.name === player2?.name)?.points ?? '–';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.matchCard, { borderColor }]}>
      <LinearGradient colors={gradient} style={styles.matchCardGrad}>

        {/* Top row: result badge + date */}
        <View style={styles.matchCardTop}>
          <View style={[styles.resultBadge, { backgroundColor: accent + '25', borderColor: accent }]}>
            <Ionicons
              name={isWin ? 'trophy' : 'close-circle'}
              size={11} color={accent}
            />
            <Text style={[styles.resultBadgeText, { color: accent }]}>
              {isWin ? 'VICTORY' : 'DEFEAT'}
            </Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>{dateStr}</Text>
            <Text style={styles.timeText}>{timeStr}</Text>
          </View>
        </View>

        {/* Players row */}
        <View style={styles.playersRow}>
          {/* You */}
          <View style={styles.playerSide}>
            <Text style={[styles.playerLabel, { color: accent }]}>YOU</Text>
            <Text style={[styles.playerName, { color: accent }]} numberOfLines={1}>
              {player1?.name}
            </Text>
            {player1?.battlefield ? (
              <Text style={styles.battlefieldText} numberOfLines={1}>
                {player1.battlefield}
              </Text>
            ) : null}
            {player1?.legend && (
              <View style={styles.legendTag}>
                {player1.legend.art ? (
                  <Image source={{ uri: player1.legend.art }} style={styles.legendTagThumb} resizeMode="cover" />
                ) : null}
                <View style={{ flex: 1 }}>
                  {player1.legend.legendName ? (
                    <Text style={styles.legendTagName} numberOfLines={1}>{player1.legend.legendName}</Text>
                  ) : null}
                  {player1.legend.domains?.length > 0 && (
                    <View style={styles.legendTagDomains}>
                      {player1.legend.domains.map(d => (
                        <View key={d} style={[styles.legendTagDot, { backgroundColor: DOMAIN_COLORS[d] || COLORS.textMuted }]} />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Score */}
          <View style={styles.scoreCenter}>
            {isBo3 ? (
              <>
                <Text style={[styles.scoreMain, { color: accent }]}>
                  {p1Wins} – {p2Wins}
                </Text>
                <Text style={styles.scoreLabel}>games</Text>
              </>
            ) : (
              <>
                <Text style={[styles.scoreMain, { color: accent }]}>
                  {p1FinalPts} – {p2FinalPts}
                </Text>
                <Text style={styles.scoreLabel}>points</Text>
              </>
            )}
            {isBo3 && (
              <View style={styles.formatPill}>
                <Text style={styles.formatPillText}>Bo3</Text>
              </View>
            )}
          </View>

          {/* Opponent */}
          <View style={[styles.playerSide, styles.playerSideRight]}>
            <Text style={styles.playerLabel}>OPP</Text>
            <Text style={styles.playerName} numberOfLines={1}>
              {player2?.name}
            </Text>
            {player2?.battlefield ? (
              <Text style={styles.battlefieldText} numberOfLines={1}>
                {player2.battlefield}
              </Text>
            ) : null}
            {player2?.legend && (
              <View style={[styles.legendTag, styles.legendTagRight]}>
                {player2.legend.art ? (
                  <Image source={{ uri: player2.legend.art }} style={styles.legendTagThumb} resizeMode="cover" />
                ) : null}
                <View style={{ flex: 1 }}>
                  {player2.legend.legendName ? (
                    <Text style={[styles.legendTagName, { textAlign: 'right' }]} numberOfLines={1}>{player2.legend.legendName}</Text>
                  ) : null}
                  {player2.legend.domains?.length > 0 && (
                    <View style={[styles.legendTagDomains, { justifyContent: 'flex-end' }]}>
                      {player2.legend.domains.map(d => (
                        <View key={d} style={[styles.legendTagDot, { backgroundColor: DOMAIN_COLORS[d] || COLORS.textMuted }]} />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Bo3 game breakdown */}
        {isBo3 && match.games?.length > 0 && (
          <View style={styles.gameBreakdown}>
            {match.games.map((game, idx) => {
              const gP1 = game.scores?.find(s => s.name === player1?.name);
              const gP2 = game.scores?.find(s => s.name === player2?.name);
              const gWin = game.winner === player1?.name;
              return (
                <View key={idx} style={styles.gameRow}>
                  <Text style={styles.gameLabel}>G{game.game}</Text>
                  <Text style={[styles.gameResult, { color: gWin ? WIN_ACCENT : LOSS_ACCENT }]}>
                    {gWin ? '▲' : '▼'}
                  </Text>
                  <Text style={styles.gameScore}>
                    {gP1?.points ?? '–'} – {gP2?.points ?? '–'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

      </LinearGradient>
    </View>
    </TouchableOpacity>
  );
};

// ── Stats Bar ─────────────────────────────────────────────────────────────────
const StatsBar = ({ history }) => {
  if (history.length === 0) return null;

  const player1Name = history[0]?.players?.[0]?.name;
  const wins   = history.filter(m => m.winner === player1Name).length;
  const losses = history.length - wins;
  const winRate = Math.round((wins / history.length) * 100);
  const winPct = wins / history.length;

  return (
    <View style={styles.statsBar}>
      <View style={styles.statItem}>
        <Text style={[styles.statNum, { color: WIN_ACCENT }]}>{wins}</Text>
        <Text style={styles.statLbl}>WINS</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statNum, { color: LOSS_ACCENT }]}>{losses}</Text>
        <Text style={styles.statLbl}>LOSSES</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statNum, { color: COLORS.goldLight }]}>{winRate}%</Text>
        <Text style={styles.statLbl}>WIN RATE</Text>
      </View>
      {/* Win rate bar */}
      <View style={styles.winBarWrapper}>
        <View style={styles.winBarBg}>
          <View style={[styles.winBarFill, { width: `${winRate}%` }]} />
        </View>
      </View>
    </View>
  );
};

// ── Matchup Stats ─────────────────────────────────────────────────────────────
// Groups matches by your legend vs opponent's legend and shows W/L per matchup
const MatchupStats = ({ history }) => {
  // Only include matches where at least your legend is tracked
  const withLegend = history.filter(m => m.players?.[0]?.legend);
  if (withLegend.length === 0) return null;

  const player1Name = history[0]?.players?.[0]?.name;

  // Build matchup map: key = "yourLegend vs oppLegend"
  const matchupMap = {};
  withLegend.forEach(m => {
    const p1 = m.players[0];
    const p2 = m.players[1];
    const myKey   = p1.legend?.legendName || 'Unknown';
    const oppKey  = p2?.legend?.legendName || '?';
    const key     = `${myKey}||${oppKey}`;
    const domains = p1.legend?.domains || [];
    const oppDomains = p2?.legend?.domains || [];
    if (!matchupMap[key]) {
      matchupMap[key] = { myName: myKey, oppName: oppKey, domains, oppDomains, wins: 0, losses: 0 };
    }
    if (m.winner === player1Name) matchupMap[key].wins++;
    else matchupMap[key].losses++;
  });

  const matchups = Object.values(matchupMap).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

  return (
    <View style={styles.matchupSection}>
      <Text style={styles.matchupTitle}>MATCHUP STATS</Text>
      {matchups.map((mu, i) => {
        const total   = mu.wins + mu.losses;
        const winPct  = total > 0 ? mu.wins / total : 0;
        const winRate = Math.round(winPct * 100);
        const rateColor = winRate >= 60 ? WIN_ACCENT : winRate >= 40 ? COLORS.goldLight : LOSS_ACCENT;
        return (
          <View key={i} style={styles.matchupRow}>
            {/* My legend */}
            <View style={styles.matchupSide}>
              {mu.domains.length > 0 && (
                <View style={styles.matchupPips}>
                  {mu.domains.map(d => (
                    <View key={d} style={[styles.matchupPip, { backgroundColor: DOMAIN_COLORS[d] || COLORS.textMuted }]} />
                  ))}
                </View>
              )}
              <Text style={styles.matchupLegendName} numberOfLines={2}>{mu.myName}</Text>
            </View>

            {/* Stats center */}
            <View style={styles.matchupCenter}>
              <Text style={styles.matchupVs}>vs</Text>
              <Text style={[styles.matchupRecord, { color: rateColor }]}>
                {mu.wins}W – {mu.losses}L
              </Text>
              <View style={styles.matchupBar}>
                <View style={[styles.matchupBarFill, { width: `${winRate}%`, backgroundColor: rateColor }]} />
              </View>
              <Text style={[styles.matchupRate, { color: rateColor }]}>{winRate}%</Text>
            </View>

            {/* Opp legend */}
            <View style={[styles.matchupSide, styles.matchupSideRight]}>
              {mu.oppDomains.length > 0 && (
                <View style={[styles.matchupPips, { justifyContent: 'flex-end' }]}>
                  {mu.oppDomains.map(d => (
                    <View key={d} style={[styles.matchupPip, { backgroundColor: DOMAIN_COLORS[d] || COLORS.textMuted }]} />
                  ))}
                </View>
              )}
              <Text style={[styles.matchupLegendName, { textAlign: 'right' }]} numberOfLines={2}>{mu.oppName}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MatchHistoryScreen({ onPremiumChange }) {
  const [history, setHistory]             = useState([]);
  const [sortOrder, setSortOrder]         = useState('desc');
  const [showMatchups, setShowMatchups]   = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [premium, setPremiumState]        = useState(false);
  const [showGate, setShowGate]           = useState(false);

  const FREE_HISTORY_LIMIT = 10;

  const load = useCallback(async () => {
    const h = await getHistory();
    const prem = await isPremium();
    setPremiumState(prem);
    setHistory(h);
  }, []);

  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

  const sorted = [...history].sort((a, b) => {
    const diff = new Date(a.date) - new Date(b.date);
    return sortOrder === 'desc' ? -diff : diff;
  });

  // Free users see only last 10 matches
  const visibleMatches = premium ? sorted : sorted.slice(0, FREE_HISTORY_LIMIT);
  const hiddenCount    = sorted.length - visibleMatches.length;

  const handleClear = () => {
    Alert.alert('Clear History', 'Delete all match history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive',
        onPress: async () => { await clearHistory(); setHistory([]); }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top","left","right"]}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HISTORY</Text>
        <View style={styles.headerActions}>

          {/* Sort toggle */}
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
          >
            <Ionicons
              name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
              size={14} color={COLORS.textSecondary}
            />
            <Text style={styles.sortBtnText}>
              {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </Text>
          </TouchableOpacity>

          {/* Matchup stats toggle — premium only */}
          {history.some(m => m.players?.[0]?.legend) && (
            <TouchableOpacity
              style={[styles.sortBtn, showMatchups && styles.sortBtnActive]}
              onPress={() => {
                if (!premium) { setShowGate(true); return; }
                setShowMatchups(v => !v);
              }}
            >
              <Ionicons name="stats-chart" size={14} color={showMatchups ? COLORS.arcaneBright : COLORS.textSecondary} />
              <Text style={[styles.sortBtnText, showMatchups && { color: COLORS.arcaneBright }]}>Matchups</Text>
              {!premium && <Ionicons name="diamond" size={10} color={COLORS.goldLight} />}
            </TouchableOpacity>
          )}

          {history.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Ionicons name="trash-outline" size={16} color={LOSS_ACCENT} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats bar */}
      <StatsBar history={history} />

      {/* Matchup stats panel */}
      {showMatchups && <MatchupStats history={history} />}

      {/* List */}
      <FlatList
        data={visibleMatches}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <MatchCard match={item} onPress={() => setSelectedMatch(item)} />
        )}
        ListFooterComponent={
          hiddenCount > 0 ? (
            <TouchableOpacity style={styles.premiumHistoryBanner} onPress={() => setShowGate(true)}>
              <Ionicons name="diamond" size={14} color={COLORS.goldLight} />
              <Text style={styles.premiumHistoryText}>
                {hiddenCount} older {hiddenCount === 1 ? 'match' : 'matches'} — unlock with Premium
              </Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.goldLight} />
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={52} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No Matches Yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete a match in the Score tab to see your history here
            </Text>
          </View>
        }
      />
      <MatchDetailModal
        match={selectedMatch}
        visible={selectedMatch !== null}
        onClose={() => setSelectedMatch(null)}
      />

      <PremiumGate
        visible={showGate}
        onClose={() => setShowGate(false)}
        onUnlock={() => { setPremiumState(true); setShowGate(false); onPremiumChange?.(); }}
        reason={
          showMatchups === false && !premium
            ? 'Advanced matchup stats require Premium'
            : `See all ${history.length} matches with Premium`
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  // ── Detail Modal ────────────────────────────────────────────────────────────
  detailOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  detailModal: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%',
    borderTopWidth: 1, borderColor: COLORS.border,
  },
  detailHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginTop: SPACING.sm,
  },
  detailHeader: {
    padding: SPACING.md, gap: SPACING.xs,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailResultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: RADIUS.sm, borderWidth: 1, alignSelf: 'flex-start',
  },
  detailResultText: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  detailDate:  { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.xs },
  detailTime:  { fontSize: 12, color: COLORS.textMuted },
  detailScore: { fontSize: 28, fontWeight: '900', marginTop: SPACING.xs },
  detailScoreSub: { fontSize: 14, fontWeight: '400', color: COLORS.textMuted },

  detailBody: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },

  detailPlayersRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  detailPlayerCol:   { flex: 1, gap: 4 },
  detailVs: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 2, marginTop: SPACING.md,
  },
  detailPlayerLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 2 },
  detailPlayerName:  { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  detailLegendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.sm, padding: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  detailLegendThumb: { width: 28, height: 36, borderRadius: 3 },
  detailLegendName:  { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  detailLegendDomains: { flexDirection: 'row', gap: 3, marginTop: 2 },
  detailDomainDot:   { width: 7, height: 7, borderRadius: 4 },
  detailBFChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
  },
  detailBFText: { fontSize: 11, color: COLORS.textMuted, flex: 1 },

  detailSectionTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 2, marginBottom: SPACING.xs,
  },
  detailGamesSection: { gap: SPACING.xs },
  detailGameRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.sm, padding: SPACING.sm,
    borderWidth: 1,
  },
  detailGameBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm, borderWidth: 1, minWidth: 48,
    justifyContent: 'center',
  },
  detailGameNum:    { fontSize: 11, fontWeight: '800' },
  detailGamePlayer: { flex: 1 },
  detailGamePoints: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary },
  detailGameBF: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2,
  },
  detailGameBFText: { fontSize: 10, color: COLORS.textMuted, flex: 1 },
  detailGameDash:   { fontSize: 16, color: COLORS.textMuted, fontWeight: '700' },

  detailMeta: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  detailMetaText: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },

  detailCloseBtn: {
    margin: SPACING.md, marginTop: 0,
    padding: SPACING.md, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  detailCloseBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 2 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sortBtnText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  clearBtn: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgCard, paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  statItem: { alignItems: 'center', minWidth: 48 },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 8, color: COLORS.textMuted, letterSpacing: 1.5, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.border },
  winBarWrapper: { flex: 1 },
  winBarBg: {
    height: 6, backgroundColor: LOSS_ACCENT + '40',
    borderRadius: 3, overflow: 'hidden',
  },
  winBarFill: {
    height: '100%', backgroundColor: WIN_ACCENT,
    borderRadius: 3,
  },

  // List
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },

  premiumHistoryBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, padding: SPACING.md,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    marginTop: SPACING.sm,
  },
  premiumHistoryText: { fontSize: 13, color: COLORS.goldLight, fontWeight: '600', flex: 1, textAlign: 'center' },

  // Match card
  matchCard: {
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1,
  },
  matchCardGrad: { padding: SPACING.md },

  matchCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.md,
  },
  resultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  resultBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  dateRow: { alignItems: 'flex-end' },
  dateText: { fontSize: 11, color: COLORS.textSecondary },
  timeText: { fontSize: 10, color: COLORS.textMuted },

  playersRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  playerSide: { flex: 1 },
  playerSideRight: { alignItems: 'flex-end' },
  playerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: COLORS.textMuted, marginBottom: 2 },
  playerName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  battlefieldText: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  scoreCenter: { alignItems: 'center', gap: 2, paddingHorizontal: SPACING.sm },
  scoreMain: { fontSize: 26, fontWeight: '800', lineHeight: 30 },
  scoreLabel: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 1 },
  formatPill: {
    backgroundColor: COLORS.arcane + '40', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: RADIUS.full, marginTop: 2,
  },
  formatPillText: { fontSize: 9, color: COLORS.arcaneBright, fontWeight: '700' },

  // Bo3 breakdown
  gameBreakdown: {
    flexDirection: 'row', gap: SPACING.md,
    marginTop: SPACING.md, paddingTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gameLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700' },
  gameResult: { fontSize: 10, fontWeight: '800' },
  gameScore: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { fontSize: 18, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center', lineHeight: 20 },

  // Legend tags on match card
  legendTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 5, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.xs, padding: 4, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  legendTagRight: { flexDirection: 'row-reverse' },
  legendTagThumb: { width: 22, height: 28, borderRadius: 2 },
  legendTagName:  { fontSize: 11, color: COLORS.textPrimary, fontWeight: '700' },
  legendTagDeck:  { fontSize: 10, color: COLORS.textMuted },
  legendTagDomains: { flexDirection: 'row', gap: 3, marginTop: 2 },
  legendTagDot:   { width: 6, height: 6, borderRadius: 3 },

  // Sort button active state
  sortBtnActive: { borderColor: COLORS.arcaneBright + '60', backgroundColor: COLORS.arcane + '20' },

  // Matchup stats
  matchupSection: {
    margin: SPACING.md, marginBottom: 0,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  matchupTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 2,
    padding: SPACING.md, paddingBottom: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  matchupRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.sm, paddingHorizontal: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border + '60',
  },
  matchupSide:      { width: 80, gap: 3 },
  matchupSideRight: { alignItems: 'flex-end' },
  matchupPips:      { flexDirection: 'row', gap: 3 },
  matchupPip:       { width: 7, height: 7, borderRadius: 4 },
  matchupLegendName: { fontSize: 11, color: COLORS.textPrimary, fontWeight: '600', lineHeight: 14 },
  matchupCenter: {
    flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: SPACING.sm,
  },
  matchupVs:     { fontSize: 9, color: COLORS.textMuted, letterSpacing: 1 },
  matchupRecord: { fontSize: 13, fontWeight: '800' },
  matchupBar: {
    width: '100%', height: 3, backgroundColor: COLORS.border,
    borderRadius: 2, overflow: 'hidden',
  },
  matchupBarFill: { height: '100%', borderRadius: 2 },
  matchupRate:    { fontSize: 10, fontWeight: '700' },
});
