import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput,
  TouchableOpacity, ScrollView, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// TODO: Re-enable RevenueCat when freemium is activated
// import RevenueCatUI from 'react-native-purchases-ui';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { getSettings, saveSettings, isPremium as checkIsPremium } from '../utils/storage';
// import { restorePurchases, ENTITLEMENT_ID } from '../utils/purchases';

export default function SettingsScreen({ visible, onClose }) {
  const [eTransferEmail, setETransferEmail] = useState('');
  const [displayName, setDisplayName]       = useState('');
  const [includeETransfer, setIncludeETransfer] = useState(true);
  const [premiumActive, setPremiumActive]   = useState(false);

  // Load settings when modal opens
  useEffect(() => {
    if (visible) {
      (async () => {
        const s = await getSettings();
        setETransferEmail(s.eTransferEmail || '');
        setDisplayName(s.displayName       || '');
        setIncludeETransfer(s.includeETransfer !== false);
        setPremiumActive(await checkIsPremium());
      })();
    }
  }, [visible]);

  // TODO: Re-enable RevenueCat when freemium is activated
  // const handleCustomerCenter = async () => {
  //   try {
  //     await RevenueCatUI.presentCustomerCenter();
  //   } catch (err) {
  //     console.error('[Settings] Customer center error:', err);
  //     Alert.alert('Unavailable', 'Could not open subscription management.');
  //   }
  // };

  // const handleRestore = async () => {
  //   const result = await restorePurchases();
  //   if (result.success) {
  //     setPremiumActive(true);
  //     Alert.alert('Restored!', 'Your premium access has been restored.');
  //   } else {
  //     Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.');
  //   }
  // };

  const handleSave = async () => {
    await saveSettings({
      eTransferEmail: eTransferEmail.trim(),
      displayName:    displayName.trim(),
      includeETransfer,
    });
    Alert.alert('Saved', 'Your settings have been updated.');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>SETTINGS</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* E-Transfer Section */}
          <Text style={styles.sectionLabel}>E-TRANSFER INFO</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                value={eTransferEmail}
                onChangeText={setETransferEmail}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={14} color={COLORS.arcaneBright} />
              <Text style={styles.hintText}>
                This email will appear on shared trade cards so the other party can send you payment.
              </Text>
            </View>
          </View>

          {/* Display Name */}
          <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NAME (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Override name on trade cards"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Sharing Preferences */}
          <Text style={styles.sectionLabel}>SHARING</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.toggleLabel}>Include e-transfer info</Text>
                <Text style={styles.toggleHint}>Show your email on shared trade cards</Text>
              </View>
              <Switch
                value={includeETransfer}
                onValueChange={setIncludeETransfer}
                trackColor={{ false: COLORS.border, true: COLORS.arcane }}
                thumbColor={includeETransfer ? COLORS.arcaneBright : COLORS.textMuted}
              />
            </View>
          </View>

          {/* TODO: Re-enable subscription section when freemium is activated */}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 14, fontWeight: '800', color: COLORS.goldLight, letterSpacing: 4 },
  saveBtn: {
    backgroundColor: COLORS.arcane,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm,
  },
  saveBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },
  sectionLabel: {
    fontSize: 10, color: COLORS.textMuted, letterSpacing: 2,
    fontWeight: '700', marginTop: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md,
  },
  inputGroup: { gap: SPACING.xs },
  inputLabel: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  input: {
    backgroundColor: COLORS.bgInput, color: COLORS.textPrimary,
    borderRadius: RADIUS.sm, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, fontSize: 15,
  },
  hintRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs,
  },
  hintText: { fontSize: 12, color: COLORS.textMuted, flex: 1, lineHeight: 18 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
  },
  toggleLabel: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  toggleHint:  { fontSize: 12, color: COLORS.textMuted },
  premiumStatusRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
  },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  manageBtnText: { fontSize: 13, color: COLORS.arcaneBright, fontWeight: '600' },
});
