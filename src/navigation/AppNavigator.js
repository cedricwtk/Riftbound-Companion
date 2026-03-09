import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../utils/theme';
import { isPremium } from '../utils/storage';
import { syncPremiumStatus } from '../utils/purchases';
import ScoreScreen from '../screens/ScoreScreen';
import CardsScreen from '../screens/CardsScreen';
import DeckBuilderScreen from '../screens/DeckBuilderScreen';
import TradesScreen from '../screens/TradesScreen';
import MatchHistoryScreen from '../screens/MatchHistoryScreen';

const Tab = createBottomTabNavigator();

// Thin gold gradient line rendered above the tab bar for premium users
function PremiumTabBorder() {
  return (
    <LinearGradient
      colors={['transparent', '#C9A84C', COLORS.goldLight, '#C9A84C', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.premiumBorder}
    />
  );
}

export default function AppNavigator({ username }) {
  const insets = useSafeAreaInsets();
  const [premium, setPremiumState] = useState(false);

  const checkPremium = useCallback(async () => {
    // Sync with RevenueCat then read local state
    await syncPremiumStatus().catch(() => {});
    const p = await isPremium();
    setPremiumState(p);
  }, []);

  React.useEffect(() => { checkPremium(); }, []);

  return (
    <View style={[styles.screenWrapper, premium && styles.premiumScreenWrapper]}>
    <NavigationContainer onStateChange={checkPremium}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.bgCard,
            borderTopColor: premium ? 'transparent' : COLORS.border,
            borderTopWidth: 1,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
            height: 56 + Math.max(insets.bottom, 8),
          },
          tabBarBackground: () => (
            <View style={{ flex: 1, backgroundColor: COLORS.bgCard }}>
              {premium && <PremiumTabBorder />}
            </View>
          ),
          tabBarActiveTintColor:   COLORS.goldLight,
          tabBarInactiveTintColor: premium ? '#8A7040' : COLORS.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 1,
          },
          tabBarIcon: ({ focused, color }) => {
            let iconName;
            if      (route.name === 'Score')   iconName = focused ? 'trophy'          : 'trophy-outline';
            else if (route.name === 'History') iconName = focused ? 'time'            : 'time-outline';
            else if (route.name === 'Cards')   iconName = focused ? 'albums'          : 'albums-outline';
            else if (route.name === 'Decks')   iconName = focused ? 'layers'          : 'layers-outline';
            else if (route.name === 'Trades')  iconName = focused ? 'swap-horizontal' : 'swap-horizontal-outline';
            return <Ionicons name={iconName} size={22} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Score" options={{ tabBarLabel: 'SCORE' }}>
          {(props) => <ScoreScreen {...props} username={username} onPremiumChange={checkPremium} />}
        </Tab.Screen>
        <Tab.Screen name="History" options={{ tabBarLabel: 'HISTORY' }}>
          {(props) => <MatchHistoryScreen {...props} onPremiumChange={checkPremium} />}
        </Tab.Screen>
        <Tab.Screen name="Cards"  component={CardsScreen}       options={{ tabBarLabel: 'CARDS' }} />
        <Tab.Screen name="Decks"  options={{ tabBarLabel: 'DECKS' }}>
          {(props) => <DeckBuilderScreen {...props} onPremiumChange={checkPremium} />}
        </Tab.Screen>
        <Tab.Screen name="Trades" component={TradesScreen}      options={{ tabBarLabel: 'TRADES' }} />
      </Tab.Navigator>
    </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  premiumScreenWrapper: {
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  premiumBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.5,
  },
});
