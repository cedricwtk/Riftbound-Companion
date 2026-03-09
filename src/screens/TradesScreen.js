import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, Platform, Image, Share,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { DOMAIN_COLORS } from '../utils/api';
import { getSettings } from '../utils/storage';
import CardsScreen from './CardsScreen';
import SettingsScreen from './SettingsScreen';
import TradeShareCard from '../components/TradeShareCard';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

const requestNotifPermission = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

const scheduleReminder = async (trade) => {
  if (!trade.meetupDate) return null;
  const meetup   = new Date(trade.meetupDate);
  const reminder = new Date(meetup.getTime() - 24 * 60 * 60 * 1000);
  if (reminder <= new Date()) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '📦 Trade Reminder!',
      body: `Trading with ${trade.traderName} tomorrow${trade.meetupPlace ? ` at ${trade.meetupPlace}` : ''}!`,
    },
    trigger: { date: reminder },
  });
};

const cancelReminder = async (id) => {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
};

const TRADES_KEY = 'riftbound_trades_v2';

const loadFromStorage = async () => {
  try {
    const raw = await AsyncStorage.getItem(TRADES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveToStorage = async (trades) => {
  try { await AsyncStorage.setItem(TRADES_KEY, JSON.stringify(trades)); } catch {}
};

const STATUSES = ['upcoming', 'completed', 'cancelled'];

const STATUS_CONFIG = {
  upcoming:  { color: COLORS.arcaneBright, icon: 'time-outline',            label: 'Upcoming'  },
  completed: { color: COLORS.win,          icon: 'checkmark-circle-outline', label: 'Completed' },
  cancelled: { color: COLORS.danger,       icon: 'close-circle-outline',     label: 'Cancelled' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
      <Ionicons name={cfg.icon} size={10} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
    </View>
  );
};

const TradeCardItem = ({ card, onRemove }) => {
  const domainColor = DOMAIN_COLORS[card.domain] || COLORS.textMuted;
  return (
    <View style={styles.tradeCardItem}>
      {/* Thumbnail */}
      {card.art?.thumbnailUrl ? (
        <Image
          source={{ uri: card.art.thumbnailUrl }}
          style={styles.tradeCardThumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.tradeCardThumb, styles.tradeCardThumbPlaceholder]}>
          <Ionicons name="image-outline" size={18} color={COLORS.textMuted} />
        </View>
      )}

      {/* Info */}
      <View style={styles.tradeCardInfo}>
        <Text style={styles.tradeCardName} numberOfLines={1}>{card.name}</Text>
        <View style={styles.tradeCardMeta}>
          <View style={[styles.tradeCardDot, { backgroundColor: domainColor }]} />
          <Text style={[styles.tradeCardDomain, { color: domainColor }]}>{card.domain}</Text>
          <Text style={styles.tradeCardType}>{card.type}</Text>
        </View>
      </View>

      {onRemove && (
        <TouchableOpacity
          onPress={() => onRemove(card)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.tradeCardRemove}
        >
          <Ionicons name="close-circle" size={18} color={COLORS.danger} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const TradeListItem = ({ trade, onPress, onDelete }) => {
  const meetup  = trade.meetupDate ? new Date(trade.meetupDate) : null;
  const isToday = meetup && meetup.toDateString() === new Date().toDateString();
  return (
    <TouchableOpacity style={styles.tradeItem} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient colors={[COLORS.bgCard, COLORS.bg]} style={styles.tradeItemGrad}>
        <View style={styles.tradeItemTop}>
          <Ionicons name="person-circle-outline" size={26} color={COLORS.arcaneBright} />
          <View style={{ flex: 1 }}>
            <Text style={styles.tradeItemName}>{trade.traderName}</Text>
            <Text style={styles.tradeItemSub}>
              {trade.cards.length} card{trade.cards.length !== 1 ? 's' : ''}
              {trade.price ? ` · $${trade.price}` : ''}
            </Text>
          </View>
          <StatusBadge status={trade.status} />
          <TouchableOpacity onPress={() => onDelete(trade)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
        {meetup && (
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={12} color={isToday ? COLORS.goldLight : COLORS.textMuted} />
            <Text style={[styles.metaText, isToday && { color: COLORS.goldLight, fontWeight: '700' }]}>
              {isToday ? 'TODAY' : meetup.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {trade.meetupTime ? ` · ${trade.meetupTime}` : ''}
            </Text>
          </View>
        )}
        {!!trade.meetupPlace && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>{trade.meetupPlace}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

export default function TradesScreen() {
  const [trades,       setTrades]       = useState([]);
  const [view,         setView]         = useState('list'); // 'list'|'detail'|'form'|'browse'
  const [selectedId,   setSelectedId]   = useState(null);
  const [filterStatus, setFilterStatus] = useState('');

  // Form fields
  const [editId,      setEditId]      = useState(null);
  const [traderName,  setTraderName]  = useState('');
  const [meetupDT,    setMeetupDT]    = useState(null);  // Date | null
  const [meetupPlace, setMeetupPlace] = useState('');
  const [notes,       setNotes]       = useState('');
  const [price,       setPrice]       = useState('');
  const [tradeCards,  setTradeCards]  = useState([]);

  // Picker visibility (Android needs separate show flags)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Settings & share
  const [showSettings, setShowSettings] = useState(false);
  const [settings,     setSettings]     = useState({});
  const shareCardRef = useRef(null);

  const load = useCallback(async () => {
    const data = await loadFromStorage();
    setTrades(data);
  }, []);

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  // Load settings on mount and when settings modal closes
  useEffect(() => {
    (async () => { setSettings(await getSettings()); })();
  }, [showSettings]);

  const selectedTrade = trades.find(t => t.id === selectedId) || null;

  const persistTrades = async (updated) => {
    setTrades(updated);
    await saveToStorage(updated);
  };

  const openNew = () => {
    setEditId(null);
    setTraderName(''); setMeetupDT(null);
    setMeetupPlace(''); setNotes(''); setPrice(''); setTradeCards([]);
    setView('form');
  };

  const openEdit = (trade) => {
    setEditId(trade.id);
    setTraderName(trade.traderName);
    setMeetupDT(trade.meetupDate ? new Date(trade.meetupDate) : null);
    setMeetupPlace(trade.meetupPlace || '');
    setNotes(trade.notes             || '');
    setPrice(trade.price             || '');
    setTradeCards(trade.cards        || []);
    setView('form');
  };

  const saveTrade = async () => {
    if (!traderName.trim()) {
      Alert.alert('Missing info', "Please enter the trader's name.");
      return;
    }
    let meetupISO = meetupDT ? meetupDT.toISOString() : null;
    // Format display time for the trade object
    const displayTime = meetupDT
      ? meetupDT.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '';

    const existing = editId ? trades.find(t => t.id === editId) : null;
    if (existing?.notificationId) await cancelReminder(existing.notificationId);

    const trade = {
      id:             existing?.id       || Date.now().toString(),
      traderName:     traderName.trim(),
      meetupDate:     meetupISO,
      meetupTime:     displayTime,
      meetupPlace:    meetupPlace.trim(),
      notes:          notes.trim(),
      price:          price.trim(),
      cards:          tradeCards,
      status:         existing?.status   || 'upcoming',
      createdAt:      existing?.createdAt || new Date().toISOString(),
      notificationId: null,
    };

    if (meetupISO) {
      const granted = await requestNotifPermission();
      if (granted) {
        const nid = await scheduleReminder(trade).catch(() => null);
        trade.notificationId = nid;
        if (nid) Alert.alert('⏰ Reminder set', "You'll be notified 1 day before the meetup.");
      }
    }

    // State-first update — this is the fix for trades not appearing
    const updated = editId
      ? trades.map(t => t.id === trade.id ? trade : t)
      : [trade, ...trades];

    await persistTrades(updated);
    setView('list');
  };

  const updateStatus = async (tradeId, status) => {
    const updated = trades.map(t => t.id === tradeId ? { ...t, status } : t);
    await persistTrades(updated);
    // selectedId stays set so detail view refreshes from updated trades array
  };

  const deleteTrade = (trade) => {
    Alert.alert('Delete Trade', `Delete trade with ${trade.traderName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await cancelReminder(trade.notificationId);
          const updated = trades.filter(t => t.id !== trade.id);
          await persistTrades(updated);
          if (selectedId === trade.id) { setSelectedId(null); setView('list'); }
        },
      },
    ]);
  };

  // ── Share functions ──────────────────────────────────────────────────────────
  const shareAsText = async (trade) => {
    const meetup = trade.meetupDate ? new Date(trade.meetupDate) : null;
    const lines = [
      `Trade with ${trade.traderName}`,
      trade.price ? `Amount: $${trade.price}` : null,
      meetup
        ? `Date: ${meetup.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${trade.meetupTime ? ` at ${trade.meetupTime}` : ''}`
        : null,
      trade.meetupPlace ? `Place: ${trade.meetupPlace}` : null,
      trade.notes ? `Notes: ${trade.notes}` : null,
      trade.cards.length > 0 ? `\nCards (${trade.cards.length}):` : null,
      ...trade.cards.map(c => `  - ${c.name} (${c.domain})`),
      settings.includeETransfer && settings.eTransferEmail
        ? `\nE-Transfer: ${settings.eTransferEmail}`
        : null,
      '\nSent from Riftbound Companion',
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n'), title: `Trade with ${trade.traderName}` });
  };

  const shareAsImage = async (trade) => {
    if (!shareCardRef.current) { shareAsText(trade); return; }
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Trade with ${trade.traderName}`,
      });
    } catch (err) {
      console.error('Share image error:', err);
      Alert.alert('Share Error', 'Could not generate image. Sharing as text instead.');
      shareAsText(trade);
    }
  };

  const handleShare = (trade) => {
    Alert.alert('Share Trade', 'How would you like to share?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'As Text',  onPress: () => shareAsText(trade) },
      { text: 'As Image', onPress: () => shareAsImage(trade) },
    ]);
  };

  const addCard = (card) => {
    if (!tradeCards.find(c => c.id === card.id)) {
      setTradeCards(prev => [...prev, card]);
    }
    setView('form');
  };

  const removeCard = (card) => setTradeCards(prev => prev.filter(c => c.id !== card.id));

  const visibleTrades = filterStatus ? trades.filter(t => t.status === filterStatus) : trades;
  const counts = {
    upcoming:  trades.filter(t => t.status === 'upcoming').length,
    completed: trades.filter(t => t.status === 'completed').length,
    cancelled: trades.filter(t => t.status === 'cancelled').length,
  };

  // ── Browse overlay ──────────────────────────────────────────────────────────
  if (view === 'browse') {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={styles.browseBar} edges={['top', 'left', 'right']}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setView('form')}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
            <Text style={styles.backBtnText}>Back to Trade</Text>
          </TouchableOpacity>
        </SafeAreaView>
        <CardsScreen onAddToDeck={addCard} addToDeckLabel="Add to Trade" />
      </View>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (view === 'detail' && selectedTrade) {
    const meetup = selectedTrade.meetupDate ? new Date(selectedTrade.meetupDate) : null;
    const cfg    = STATUS_CONFIG[selectedTrade.status] || STATUS_CONFIG.upcoming;
    return (
      <>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => { setSelectedId(null); setView('list'); }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.detailTitle} numberOfLines={1}>Trade · {selectedTrade.traderName}</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleShare(selectedTrade)}>
            <Ionicons name="share-outline" size={17} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(selectedTrade)}>
            <Ionicons name="pencil-outline" size={17} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.detailContent}>
          {/* Status banner */}
          <View style={[styles.statusBar, { borderColor: cfg.color, backgroundColor: cfg.color + '15' }]}>
            <Ionicons name={cfg.icon} size={18} color={cfg.color} />
            <Text style={[styles.statusBarText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>

          {/* Meetup info */}
          {(meetup || selectedTrade.meetupPlace) && (
            <View style={styles.detailCard}>
              <Text style={styles.detailCardLabel}>MEETUP</Text>
              {meetup && (
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={15} color={COLORS.arcaneBright} />
                  <Text style={styles.detailRowText}>
                    {meetup.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    {selectedTrade.meetupTime ? `  ·  ${selectedTrade.meetupTime}` : ''}
                  </Text>
                </View>
              )}
              {!!selectedTrade.meetupPlace && (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={15} color={COLORS.arcaneBright} />
                  <Text style={styles.detailRowText}>{selectedTrade.meetupPlace}</Text>
                </View>
              )}
            </View>
          )}

          {/* Agreed amount */}
          {!!selectedTrade.price && (
            <View style={styles.detailCard}>
              <Text style={styles.detailCardLabel}>AGREED AMOUNT</Text>
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={15} color={COLORS.goldLight} />
                <Text style={[styles.detailRowText, { color: COLORS.goldLight, fontWeight: '700', fontSize: 16 }]}>
                  ${selectedTrade.price}
                </Text>
              </View>
            </View>
          )}

          {/* Notes */}
          {!!selectedTrade.notes && (
            <View style={styles.detailCard}>
              <Text style={styles.detailCardLabel}>NOTES</Text>
              <Text style={styles.notesText}>{selectedTrade.notes}</Text>
            </View>
          )}

          {/* Cards */}
          <View style={styles.detailCard}>
            <Text style={styles.detailCardLabel}>CARDS ({selectedTrade.cards.length})</Text>
            {selectedTrade.cards.length === 0
              ? <Text style={styles.emptyText}>No cards added</Text>
              : selectedTrade.cards.map(c => <TradeCardItem key={c.id} card={c} />)
            }
          </View>

          {/* Status actions — always visible, current status highlighted */}
          <View style={styles.detailCard}>
            <Text style={styles.detailCardLabel}>MARK AS</Text>
            <View style={styles.statusActions}>
              {STATUSES.map(s => {
                const c = STATUS_CONFIG[s];
                const active = selectedTrade.status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusActionBtn,
                      { borderColor: active ? c.color : COLORS.border },
                      active && { backgroundColor: c.color + '25' },
                    ]}
                    onPress={() => !active && updateStatus(selectedTrade.id, s)}
                    disabled={active}
                  >
                    <Ionicons name={c.icon} size={15} color={active ? c.color : COLORS.textMuted} />
                    <Text style={[styles.statusActionText, { color: active ? c.color : COLORS.textMuted }]}>
                      {c.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={11} color={c.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Offscreen share card for image capture */}
      <View style={styles.offscreen} pointerEvents="none">
        <TradeShareCard ref={shareCardRef} trade={selectedTrade} settings={settings} />
      </View>
      </>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TRADES</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <TouchableOpacity style={styles.newBtn} onPress={openNew}>
            <Ionicons name="add" size={18} color={COLORS.textPrimary} />
            <Text style={styles.newBtnText}>New Trade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={17} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterRow}>
        {[
          { key: '',          label: `All (${trades.length})` },
          { key: 'upcoming',  label: `Upcoming (${counts.upcoming})` },
          { key: 'completed', label: `Done (${counts.completed})` },
          { key: 'cancelled', label: `Cancelled (${counts.cancelled})` },
        ].map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterTab, filterStatus === key && styles.filterTabActive]}
            onPress={() => setFilterStatus(key)}
          >
            <Text style={[styles.filterTabText, filterStatus === key && styles.filterTabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleTrades}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TradeListItem
            trade={item}
            onPress={() => { setSelectedId(item.id); setView('detail'); }}
            onDelete={deleteTrade}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="swap-horizontal-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>
              {filterStatus ? `No ${filterStatus} trades` : 'No Trades Yet'}
            </Text>
            {!filterStatus && (
              <>
                <Text style={styles.emptySubtitle}>Schedule a card trade with another player</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={openNew}>
                  <Text style={styles.emptyBtnText}>Schedule Trade</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        }
      />

      {/* Form modal */}
      <Modal visible={view === 'form'} animationType="slide" onRequestClose={() => setView('list')}>
        <SafeAreaView style={styles.formSafe} edges={['top', 'left', 'right']}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setView('list')}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.formTitle}>{editId ? 'EDIT TRADE' : 'NEW TRADE'}</Text>
            <TouchableOpacity onPress={saveTrade} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TRADER NAME *</Text>
              <TextInput
                style={styles.input} value={traderName} onChangeText={setTraderName}
                placeholder="Who are you trading with?" placeholderTextColor={COLORS.textMuted} autoFocus
              />
            </View>

            <Text style={styles.sectionDivider}>MEETUP DETAILS</Text>

            {/* Date picker field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DATE</Text>
              <TouchableOpacity
                style={styles.pickerField}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={COLORS.arcaneBright} />
                <Text style={[styles.pickerFieldText, !meetupDT && styles.pickerFieldPlaceholder]}>
                  {meetupDT
                    ? meetupDT.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Select date'}
                </Text>
                {meetupDT && (
                  <TouchableOpacity onPress={() => setMeetupDT(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {/* Time picker field — only shown once date is set */}
            {meetupDT && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TIME</Text>
                <TouchableOpacity
                  style={styles.pickerField}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={18} color={COLORS.arcaneBright} />
                  <Text style={styles.pickerFieldText}>
                    {meetupDT.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {meetupDT && (
              <View style={styles.reminderHint}>
                <Ionicons name="notifications-outline" size={13} color={COLORS.arcaneBright} />
                <Text style={styles.reminderHintText}>Reminder will be sent 1 day before</Text>
              </View>
            )}

            {/* Native date picker */}
            {showDatePicker && (
              <DateTimePicker
                value={meetupDT || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={(e, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) {
                    // Preserve existing time or default to noon
                    const base = meetupDT || new Date();
                    date.setHours(base.getHours() || 12, base.getMinutes() || 0, 0, 0);
                    setMeetupDT(date);
                    // On Android, show time picker right after date
                    if (Platform.OS === 'android') setShowTimePicker(true);
                  }
                }}
              />
            )}

            {/* Native time picker */}
            {showTimePicker && (
              <DateTimePicker
                value={meetupDT || new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                is24Hour={true}
                onChange={(e, date) => {
                  setShowTimePicker(Platform.OS === 'ios');
                  if (date) setMeetupDT(date);
                }}
              />
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PLACE</Text>
              <TextInput
                style={styles.input} value={meetupPlace} onChangeText={setMeetupPlace}
                placeholder="Where are you meeting?" placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOTES</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]} value={notes} onChangeText={setNotes}
                placeholder="Card conditions, anything else..."
                placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AGREED AMOUNT</Text>
              <TextInput
                style={styles.input} value={price} onChangeText={setPrice}
                placeholder="$0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={styles.sectionDivider}>CARDS IN TRADE</Text>
            {tradeCards.length === 0
              ? <Text style={styles.emptyText}>No cards added yet</Text>
              : tradeCards.map(c => <TradeCardItem key={c.id} card={c} onRemove={removeCard} />)
            }
            <TouchableOpacity style={styles.addCardsBtn} onPress={() => setView('browse')}>
              <LinearGradient colors={[COLORS.arcane, COLORS.arcaneBright]} style={styles.addCardsBtnGrad}>
                <Ionicons name="add" size={18} color={COLORS.textPrimary} />
                <Text style={styles.addCardsBtnText}>Browse & Add Cards</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Settings modal */}
      <SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 4 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.arcane, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
  },
  newBtnText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    gap: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexWrap: 'wrap',
  },
  filterTab: {
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
  },
  filterTabActive:     { backgroundColor: COLORS.arcane, borderColor: COLORS.arcaneBright },
  filterTabText:       { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  filterTabTextActive: { color: COLORS.textPrimary },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },
  tradeItem: { borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  tradeItemGrad: { padding: SPACING.md },
  tradeItemTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  tradeItemName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  tradeItemSub:  { fontSize: 11, color: COLORS.textMuted },
  deleteBtn:     { padding: SPACING.xs },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 },
  metaText:      { fontSize: 12, color: COLORS.textMuted, flex: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm,
  },
  detailTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  iconBtn: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  detailContent:   { padding: SPACING.md, gap: SPACING.md, paddingBottom: 60 },
  detailCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  detailCardLabel: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 2, fontWeight: '700' },
  detailRow:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  detailRowText:   { fontSize: 14, color: COLORS.textPrimary, flex: 1, lineHeight: 20 },
  notesText:       { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
  },
  statusBarText:   { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  statusActions:   { flexDirection: 'row', gap: SPACING.sm },
  statusActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1.5,
  },
  statusActionText: { fontSize: 11, fontWeight: '700' },
  tradeCardItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 6,
    overflow: 'hidden',
  },
  tradeCardThumb: {
    width: 52, height: 52,
  },
  tradeCardThumbPlaceholder: {
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center', alignItems: 'center',
  },
  tradeCardInfo: {
    flex: 1, paddingHorizontal: SPACING.sm, gap: 3,
  },
  tradeCardName:   { fontSize: 13, color: COLORS.textPrimary, fontWeight: '700' },
  tradeCardMeta:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tradeCardDot:    { width: 6, height: 6, borderRadius: 3 },
  tradeCardDomain: { fontSize: 11, fontWeight: '600' },
  tradeCardType:   { fontSize: 11, color: COLORS.textMuted },
  tradeCardRemove: { paddingHorizontal: SPACING.sm },
  offscreen: { position: 'absolute', left: -9999, top: -9999, opacity: 0 },
  formSafe:   { flex: 1, backgroundColor: COLORS.bg },
  formHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  formTitle:   { fontSize: 14, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 4 },
  saveBtn:     { backgroundColor: COLORS.arcane, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm },
  saveBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
  formContent: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },
  sectionDivider: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 2, fontWeight: '700', marginTop: SPACING.sm },
  inputGroup:  { gap: SPACING.xs },
  inputLabel:  { fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  input: {
    backgroundColor: COLORS.bgInput, color: COLORS.textPrimary,
    borderRadius: RADIUS.sm, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, fontSize: 15,
  },
  inputMultiline: { height: 90, textAlignVertical: 'top' },
  pickerField: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgInput, borderRadius: RADIUS.sm,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  pickerFieldText:        { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  pickerFieldPlaceholder: { color: COLORS.textMuted },
  reminderHint: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.arcane + '18', padding: SPACING.sm,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.arcane + '35',
  },
  reminderHintText: { fontSize: 12, color: COLORS.arcaneBright },
  addCardsBtn:     { borderRadius: RADIUS.md, overflow: 'hidden', marginTop: SPACING.sm },
  addCardsBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, padding: SPACING.md,
  },
  addCardsBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl, paddingHorizontal: SPACING.xl },
  emptyTitle: { fontSize: 17, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center' },
  emptyBtn: {
    marginTop: SPACING.lg, backgroundColor: COLORS.arcane,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
  },
  emptyBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
  emptyText:    { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },
  browseBar:    { backgroundColor: COLORS.bgCard, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, padding: SPACING.md },
  backBtnText:  { color: COLORS.textPrimary, fontSize: 15 },
});
