import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import RevenueCatUI from 'react-native-purchases-ui';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import {
  getOfferings, purchasePackage, restorePurchases, ENTITLEMENT_ID,
} from '../utils/purchases';

// Features listed on the paywall
const PREMIUM_FEATURES = [
  { icon: 'time',          label: 'Unlimited match history' },
  { icon: 'albums',        label: 'Unlimited deck slots'    },
  { icon: 'stats-chart',   label: 'Advanced stats — win rate by legend & battlefield' },
  { icon: 'trophy',        label: 'Matchup matrix'          },
];

export default function PremiumGate({ visible, onClose, onUnlock, reason }) {
  const [loading, setLoading]     = useState(false);
  const [offering, setOffering]   = useState(null);

  // Load offerings when gate opens
  useEffect(() => {
    if (visible) {
      (async () => {
        const off = await getOfferings();
        setOffering(off);
      })();
    }
  }, [visible]);

  // ── Try RevenueCat Paywall first ───────────────────────────────────────────
  const handlePaywall = async () => {
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });

      // RevenueCatUI.PAYWALL_RESULT values:
      // NOT_PRESENTED — user already has entitlement
      // PURCHASED — user bought something
      // RESTORED — user restored purchases
      // CANCELLED / ERROR — user dismissed or error
      if (
        result === RevenueCatUI.PAYWALL_RESULT.PURCHASED ||
        result === RevenueCatUI.PAYWALL_RESULT.RESTORED ||
        result === RevenueCatUI.PAYWALL_RESULT.NOT_PRESENTED
      ) {
        onUnlock?.();
        onClose?.();
      }
    } catch (err) {
      console.error('[PremiumGate] Paywall error:', err);
      // Fall back to manual purchase
      handleManualPurchase();
    }
  };

  // ── Manual purchase fallback ───────────────────────────────────────────────
  const handleManualPurchase = async () => {
    if (!offering) {
      Alert.alert('Unavailable', 'Unable to load products. Please try again later.');
      return;
    }

    // Find the lifetime package
    const lifetimePkg = offering.lifetime
      || offering.availablePackages?.find(p => p.packageType === 'LIFETIME')
      || offering.availablePackages?.[0];

    if (!lifetimePkg) {
      Alert.alert('Unavailable', 'No products available. Please try again later.');
      return;
    }

    setLoading(true);
    const result = await purchasePackage(lifetimePkg);
    setLoading(false);

    if (result.success) {
      Alert.alert('Welcome to Premium!', 'All features are now unlocked.');
      onUnlock?.();
      onClose?.();
    } else if (result.cancelled) {
      // User cancelled — do nothing
    } else if (result.error) {
      Alert.alert('Purchase Failed', result.error);
    }
  };

  // ── Restore purchases ──────────────────────────────────────────────────────
  const handleRestore = async () => {
    setLoading(true);
    const result = await restorePurchases();
    setLoading(false);

    if (result.success) {
      Alert.alert('Restored!', 'Your premium access has been restored.');
      onUnlock?.();
      onClose?.();
    } else {
      Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Crown icon */}
          <LinearGradient
            colors={['#8B6914', COLORS.goldLight]}
            style={styles.iconCircle}
          >
            <Ionicons name="diamond" size={28} color="#fff" />
          </LinearGradient>

          <Text style={styles.title}>RIFTBOUND PREMIUM</Text>
          <Text style={styles.subtitle}>One-time purchase · Lifetime access</Text>

          {/* Reason why they hit the gate */}
          {reason ? (
            <View style={styles.reasonChip}>
              <Ionicons name="lock-closed" size={12} color={COLORS.goldLight} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ) : null}

          {/* Feature list */}
          <View style={styles.featureList}>
            {PREMIUM_FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name={f.icon} size={16} color={COLORS.goldLight} />
                <Text style={styles.featureText}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Purchase button — tries RevenueCat Paywall, falls back to manual */}
          <TouchableOpacity
            style={styles.purchaseBtn}
            onPress={handlePaywall}
            activeOpacity={0.85}
            disabled={loading}
          >
            <LinearGradient colors={['#8B6914', COLORS.goldLight]} style={styles.purchaseBtnGrad}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="diamond" size={16} color="#fff" />
                  <Text style={styles.purchaseBtnText}>UNLOCK PREMIUM</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Restore purchases */}
          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={loading}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.lg, paddingBottom: SPACING.xl,
    alignItems: 'center', gap: SPACING.sm,
    borderTopWidth: 1, borderColor: '#8B6914',
  },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: 18, fontWeight: '900', color: COLORS.goldLight,
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 13, color: COLORS.textMuted,
  },
  reasonChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
    marginTop: SPACING.xs,
  },
  reasonText: { fontSize: 12, color: COLORS.goldLight, fontWeight: '600' },
  featureList: {
    width: '100%', gap: SPACING.sm,
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  featureText: { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  purchaseBtn: {
    width: '100%', borderRadius: RADIUS.md, overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  purchaseBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: SPACING.md,
  },
  purchaseBtnText: {
    fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 2,
  },
  restoreBtn: { paddingVertical: SPACING.xs },
  restoreText: { fontSize: 13, color: COLORS.arcaneBright, fontWeight: '600' },
  dismissBtn: { paddingVertical: SPACING.sm },
  dismissText: { fontSize: 13, color: COLORS.textMuted },
});
