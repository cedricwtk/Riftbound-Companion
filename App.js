import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, Image, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
// TODO: Re-enable RevenueCat when freemium is activated
// import { initPurchases, addCustomerInfoListener } from './src/utils/purchases';

// Hold native splash until we're ready to take over
SplashScreen.preventAutoHideAsync().catch(() => {});

const { width: SW, height: SH } = Dimensions.get('window');
const USERNAME_KEY = 'riftbound_username';

export const getUsername = async () => {
  try { return await AsyncStorage.getItem(USERNAME_KEY); }
  catch { return null; }
};
export const setUsername = async (name) => {
  try { await AsyncStorage.setItem(USERNAME_KEY, name); }
  catch {}
};

// ─────────────────────────────────────────────────────────────────────────────
// Static star positions — seeded so they're stable across renders
// ─────────────────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 90 }, (_, i) => {
  const a = (i * 9301 + 49297) % 233280;
  const b = (i * 7919  + 13337) % 233280;
  return {
    x:    (a / 233280) * SW,
    y:    (b / 233280) * SH,
    size: i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1,
    op:   0.12 + ((a % 100) / 100) * 0.35,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedSplash
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedSplash({ onFinished }) {
  const exit        = useRef(new Animated.Value(1)).current;
  const bgOpacity   = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale   = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.55)).current;
  const titleY      = useRef(new Animated.Value(28)).current;
  const titleOp     = useRef(new Animated.Value(0)).current;
  const subOp       = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Glow pulse loop — starts immediately
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.09, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    // Main entrance sequence
    Animated.timing(bgOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
      .start(() => {
        Animated.parallel([
          Animated.timing(glowOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.spring(glowScale,   { toValue: 1, tension: 35, friction: 8, useNativeDriver: true }),
          Animated.spring(logoScale,   { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
          Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start(() => {
          Animated.parallel([
            Animated.timing(titleOp, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(titleY,  { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start(() => {
            Animated.timing(subOp, { toValue: 1, duration: 260, useNativeDriver: true })
              .start(() => {
                // Hold 800ms then fade the whole screen out
                setTimeout(() => {
                  Animated.timing(exit, { toValue: 0, duration: 500, useNativeDriver: true })
                    .start(onFinished);
                }, 800);
              });
          });
        });
      });
  }, []);

  const LOGO_SIZE = SW * 0.50;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.splashRoot, { opacity: exit }]}>
      {/* Background gradient */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
        <LinearGradient
          colors={['#060810', '#0C1228', '#080A18', '#060810']}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Stars */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STARS.map((s, i) => (
          <View key={i} style={{
            position: 'absolute',
            left: s.x, top: s.y,
            width: s.size, height: s.size,
            borderRadius: s.size,
            backgroundColor: '#A8CCFF',
            opacity: s.op,
          }} />
        ))}
      </View>

      {/* Outer glow ring — blue */}
      <Animated.View style={[
        styles.glowRingOuter,
        { width: LOGO_SIZE + 140, height: LOGO_SIZE + 140, borderRadius: (LOGO_SIZE + 140) / 2 },
        { opacity: glowOpacity, transform: [{ scale: Animated.multiply(glowScale, pulseAnim) }] },
      ]} />

      {/* Inner glow ring — gold */}
      <Animated.View style={[
        styles.glowRingInner,
        { width: LOGO_SIZE + 64, height: LOGO_SIZE + 64, borderRadius: (LOGO_SIZE + 64) / 2 },
        { opacity: glowOpacity, transform: [{ scale: glowScale }] },
      ]} />

      {/* Logo — uses the real icon with black bg removed visually via blending */}
      <Animated.View style={[
        styles.logoWrap,
        { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE / 2 },
        { opacity: logoOpacity, transform: [{ scale: logoScale }] },
      ]}>
        <Image
          source={require('./assets/adaptive-icon.png')}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Title */}
      <Animated.Text style={[styles.splashTitle, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
        RIFTBOUND
      </Animated.Text>

      {/* Subtitle + ornament */}
      <Animated.View style={[styles.splashSubRow, { opacity: subOp }]}>
        <View style={styles.ornamentDot} />
        <View style={styles.ornamentLine} />
        <Text style={styles.splashSub}>COMPANION</Text>
        <View style={styles.ornamentLine} />
        <View style={styles.ornamentDot} />
      </Animated.View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingScreen({ onDone }) {
  const insets    = useSafeAreaInsets();
  const [name, setName] = useState('');
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleConfirm = async () => {
    const trimmed = name.trim() || 'Player 1';
    await setUsername(trimmed);
    onDone(trimmed);
  };

  return (
    <LinearGradient colors={['#060810', '#0C1228', '#060810']} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[
          styles.onboardingContent,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
          {/* Logo */}
          <View style={styles.logoArea}>
            <Image
              source={require('./assets/adaptive-icon.png')}
              style={styles.onboardLogo}
              resizeMode="contain"
            />
            <Text style={styles.appTitle}>RIFTBOUND</Text>
            <Text style={styles.appSubtitle}>COMPANION</Text>
          </View>

          {/* Welcome text */}
          <View style={styles.welcomeArea}>
            <Text style={styles.welcomeTitle}>Welcome, Summoner</Text>
            <Text style={styles.welcomeSubtitle}>
              What should we call you? This name appears in the score tracker.
            </Text>
          </View>

          {/* Input */}
          <View style={styles.inputArea}>
            <TextInput
              style={styles.usernameInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name..."
              placeholderTextColor="#4A4A6A"
              maxLength={20}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
            <Text style={styles.inputHint}>You can change this later in Settings</Text>
          </View>

          {/* Legal disclaimer */}
          <Text style={styles.legalText}>
            Riftbound Companion was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games.  Riot Games does not endorse or sponsor this project.
          </Text>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.startBtn, !name.trim() && styles.startBtnDim]}
            onPress={handleConfirm}
          >
            <LinearGradient
              colors={['#5B3A8C', '#7B5EA7']}
              style={styles.startBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.startBtnText}>
                {name.trim() ? `Let's go, ${name.trim()}!` : 'Continue as Player 1'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
function Root() {
  const [appReady,       setAppReady]       = useState(false);
  const [splashDone,     setSplashDone]     = useState(false);
  const [username,       setUsernameState]  = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await getUsername();
      if (!stored) setShowOnboarding(true);
      else setUsernameState(stored);

      // TODO: Re-enable RevenueCat when freemium is activated
      // await initPurchases();
      // addCustomerInfoListener((isPremium) => {
      //   console.log('[RevenueCat] Premium status changed:', isPremium);
      // });

      setAppReady(true);
      // Hand off from native splash to our JS splash
      await SplashScreen.hideAsync().catch(() => {});
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#060810' }}>
      {/* App content renders underneath while splash is still visible */}
      {appReady && (
        showOnboarding
          ? <OnboardingScreen onDone={(n) => { setUsernameState(n); setShowOnboarding(false); }} />
          : <AppNavigator username={username} />
      )}

      {/* JS animated splash sits on top and fades away */}
      {!splashDone && (
        <AnimatedSplash onFinished={() => setSplashDone(true)} />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#060810" translucent />
      <Root />
    </SafeAreaProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Splash
  splashRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 999,
  },
  glowRingOuter: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(40, 120, 255, 0.22)',
    shadowColor: '#2878FF',
    shadowRadius: 48,
    shadowOpacity: 1,
    elevation: 0,
  },
  glowRingInner: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 175, 30, 0.28)',
    shadowColor: '#FFAF1E',
    shadowRadius: 28,
    shadowOpacity: 1,
    elevation: 0,
  },
  logoWrap: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  splashTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#F0C840',
    letterSpacing: 10,
    textShadowColor: 'rgba(240, 200, 64, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginTop: 4,
  },
  splashSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splashSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7AADFF',
    letterSpacing: 7,
  },
  ornamentLine: {
    width: 28, height: 1.5,
    backgroundColor: 'rgba(100, 160, 255, 0.35)',
    borderRadius: 1,
  },
  ornamentDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#F0C840',
    opacity: 0.85,
  },

  // Onboarding
  onboardingContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
  },
  logoArea: { alignItems: 'center', gap: 4 },
  onboardLogo: { width: 90, height: 90, marginBottom: 8 },
  appTitle: { fontSize: 26, fontWeight: '900', color: '#C9A84C', letterSpacing: 8 },
  appSubtitle: { fontSize: 11, fontWeight: '600', color: '#5A5A7A', letterSpacing: 6 },
  welcomeArea: { gap: 10 },
  welcomeTitle: { fontSize: 26, fontWeight: '800', color: '#E8E8F0' },
  welcomeSubtitle: { fontSize: 15, color: '#8080A0', lineHeight: 22 },
  inputArea: { gap: 8 },
  usernameInput: {
    backgroundColor: '#1A1A2E', color: '#E8E8F0',
    borderRadius: 12, padding: 16,
    fontSize: 18, fontWeight: '600',
    borderWidth: 1, borderColor: '#3A2A5C',
  },
  inputHint: { fontSize: 12, color: '#4A4A6A', textAlign: 'center' },
  legalText: { fontSize: 10, color: '#4A4A6A', textAlign: 'center', lineHeight: 15 },
  startBtn: { borderRadius: 14, overflow: 'hidden' },
  startBtnDim: { opacity: 0.7 },
  startBtnGrad: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, paddingVertical: 18,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
});
