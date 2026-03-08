import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../utils/theme';

import ScoreScreen from '../screens/ScoreScreen';
import CardsScreen from '../screens/CardsScreen';
import DeckBuilderScreen from '../screens/DeckBuilderScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.bgCard,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            paddingBottom: 8,
            paddingTop: 8,
            height: 68,
          },
          tabBarActiveTintColor: COLORS.goldLight,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 1,
          },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Score') iconName = focused ? 'trophy' : 'trophy-outline';
            else if (route.name === 'Cards') iconName = focused ? 'albums' : 'albums-outline';
            else if (route.name === 'Decks') iconName = focused ? 'layers' : 'layers-outline';
            return <Ionicons name={iconName} size={22} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Score" component={ScoreScreen} options={{ tabBarLabel: 'SCORE' }} />
        <Tab.Screen name="Cards" component={CardsScreen} options={{ tabBarLabel: 'CARDS' }} />
        <Tab.Screen name="Decks" component={DeckBuilderScreen} options={{ tabBarLabel: 'DECKS' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
