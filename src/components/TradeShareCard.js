import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { DOMAIN_COLORS } from '../utils/api';

const TradeShareCard = forwardRef(({ trade, settings }, ref) => {
  const meetup = trade.meetupDate ? new Date(trade.meetupDate) : null;
  const showETransfer = settings?.includeETransfer && settings?.eTransferEmail;

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* Header branding */}
      <View style={styles.header}>
        <Text style={styles.brand}>RIFTBOUND</Text>
        <Text style={styles.brandSub}>TRADE CARD</Text>
      </View>

      {/* Gold divider */}
      <View style={styles.goldDivider} />

      {/* Trader + Price */}
      <View style={styles.section}>
        <Text style={styles.label}>TRADING WITH</Text>
        <Text style={styles.traderName}>{trade.traderName}</Text>
        {!!trade.price && (
          <View style={styles.priceRow}>
            <Ionicons name="cash-outline" size={16} color={COLORS.goldLight} />
            <Text style={styles.priceText}>${trade.price}</Text>
          </View>
        )}
      </View>

      {/* Meetup details */}
      {(meetup || trade.meetupPlace) && (
        <View style={styles.section}>
          <Text style={styles.label}>MEETUP</Text>
          {meetup && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.arcaneBright} />
              <Text style={styles.infoText}>
                {meetup.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {trade.meetupTime ? `  ·  ${trade.meetupTime}` : ''}
              </Text>
            </View>
          )}
          {!!trade.meetupPlace && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.arcaneBright} />
              <Text style={styles.infoText}>{trade.meetupPlace}</Text>
            </View>
          )}
        </View>
      )}

      {/* Notes */}
      {!!trade.notes && (
        <View style={styles.section}>
          <Text style={styles.label}>NOTES</Text>
          <Text style={styles.notesText}>{trade.notes}</Text>
        </View>
      )}

      {/* Cards */}
      {trade.cards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>CARDS ({trade.cards.length})</Text>
          {trade.cards.map(c => {
            const domainColor = DOMAIN_COLORS[c.domain] || COLORS.textMuted;
            return (
              <View key={c.id} style={styles.cardRow}>
                {c.art?.thumbnailUrl ? (
                  <Image
                    source={{ uri: c.art.thumbnailUrl }}
                    style={styles.cardThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}>
                    <Ionicons name="image-outline" size={14} color={COLORS.textMuted} />
                  </View>
                )}
                <View style={[styles.domainDot, { backgroundColor: domainColor }]} />
                <Text style={styles.cardName} numberOfLines={1}>{c.name}</Text>
                <Text style={[styles.cardDomain, { color: domainColor }]}>{c.domain}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* E-Transfer */}
      {showETransfer && (
        <View style={styles.eTransferBox}>
          <Ionicons name="wallet-outline" size={15} color={COLORS.goldLight} />
          <View style={{ flex: 1 }}>
            <Text style={styles.eTransferLabel}>E-TRANSFER TO</Text>
            <Text style={styles.eTransferEmail}>{settings.eTransferEmail}</Text>
          </View>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerText}>Generated with Riftbound Companion</Text>
      </View>
    </View>
  );
});

TradeShareCard.displayName = 'TradeShareCard';
export default TradeShareCard;

const styles = StyleSheet.create({
  card: {
    width: 400,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    alignItems: 'center', gap: 2,
  },
  brand: {
    fontSize: 22, fontWeight: '900', color: COLORS.goldLight,
    letterSpacing: 6,
  },
  brandSub: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 4,
  },
  goldDivider: {
    height: 1.5,
    backgroundColor: COLORS.gold,
    borderRadius: 1,
    opacity: 0.5,
  },
  section: { gap: SPACING.xs },
  label: {
    fontSize: 9, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 2,
  },
  traderName: {
    fontSize: 20, fontWeight: '800', color: COLORS.textPrimary,
  },
  priceRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    marginTop: 2,
  },
  priceText: {
    fontSize: 18, fontWeight: '800', color: COLORS.goldLight,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
  },
  infoText: {
    fontSize: 13, color: COLORS.textPrimary, flex: 1,
  },
  notesText: {
    fontSize: 13, color: COLORS.textSecondary, lineHeight: 20,
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: 4,
  },
  cardThumb: { width: 40, height: 40 },
  cardThumbPlaceholder: {
    backgroundColor: COLORS.bgElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  domainDot: {
    width: 6, height: 6, borderRadius: 3, marginLeft: SPACING.sm,
  },
  cardName: {
    fontSize: 12, fontWeight: '700', color: COLORS.textPrimary,
    flex: 1, marginLeft: SPACING.xs,
  },
  cardDomain: {
    fontSize: 10, fontWeight: '600', marginRight: SPACING.sm,
  },
  eTransferBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.gold + '15',
    borderWidth: 1, borderColor: COLORS.gold + '40',
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  eTransferLabel: {
    fontSize: 9, fontWeight: '700', color: COLORS.goldLight,
    letterSpacing: 2,
  },
  eTransferEmail: {
    fontSize: 14, fontWeight: '600', color: COLORS.textPrimary,
    marginTop: 1,
  },
  footer: { alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
  footerDivider: {
    height: 1, width: '60%',
    backgroundColor: COLORS.border, borderRadius: 1,
  },
  footerText: {
    fontSize: 10, color: COLORS.textMuted, letterSpacing: 1,
  },
});
