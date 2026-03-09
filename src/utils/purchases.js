import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import { setPremium } from './storage';

// RevenueCat API keys
const API_KEY = 'test_gxNyDcBlppLjItfxJbAwiazuWVJ';

// Entitlement identifier — must match what you set in RevenueCat dashboard
export const ENTITLEMENT_ID = 'riftbound companion Premium';

// ── Initialize ───────────────────────────────────────────────────────────────
export const initPurchases = async () => {
  try {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: API_KEY });
    console.log('[RevenueCat] Configured successfully');

    // Sync entitlement state on init
    await syncPremiumStatus();
  } catch (err) {
    console.error('[RevenueCat] Configuration error:', err);
  }
};

// ── Check entitlement ────────────────────────────────────────────────────────
export const checkEntitlement = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    return !!entitlement;
  } catch (err) {
    console.error('[RevenueCat] Entitlement check error:', err);
    return false;
  }
};

// ── Sync RevenueCat state with local storage ─────────────────────────────────
export const syncPremiumStatus = async () => {
  const isPremiumRC = await checkEntitlement();
  await setPremium(isPremiumRC);
  return isPremiumRC;
};

// ── Get current offerings ────────────────────────────────────────────────────
export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) {
      return offerings.current;
    }
    console.warn('[RevenueCat] No current offering found');
    return null;
  } catch (err) {
    console.error('[RevenueCat] Offerings error:', err);
    return null;
  }
};

// ── Purchase a package ───────────────────────────────────────────────────────
export const purchasePackage = async (pkg) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isEntitled = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    await setPremium(isEntitled);
    return { success: isEntitled, customerInfo };
  } catch (err) {
    if (err.userCancelled) {
      return { success: false, cancelled: true };
    }
    console.error('[RevenueCat] Purchase error:', err);
    return { success: false, error: err.message };
  }
};

// ── Restore purchases ────────────────────────────────────────────────────────
export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isEntitled = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    await setPremium(isEntitled);
    return { success: isEntitled, customerInfo };
  } catch (err) {
    console.error('[RevenueCat] Restore error:', err);
    return { success: false, error: err.message };
  }
};

// ── Get customer info ────────────────────────────────────────────────────────
export const getCustomerInfo = async () => {
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.error('[RevenueCat] Customer info error:', err);
    return null;
  }
};

// ── Listen for customer info updates ─────────────────────────────────────────
export const addCustomerInfoListener = (callback) => {
  Purchases.addCustomerInfoUpdateListener(async (customerInfo) => {
    const isEntitled = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    await setPremium(isEntitled);
    callback?.(isEntitled, customerInfo);
  });
};
