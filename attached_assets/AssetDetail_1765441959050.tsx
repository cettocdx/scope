import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { PortfolioAsset } from '../types';
import { ChevronLeft, MoreHorizontal, ShieldCheck, TrendingUp, TrendingDown, Zap, Clock } from 'lucide-react-native';
import { FinancialChart } from './FinancialChart';

interface AssetDetailProps {
  asset: PortfolioAsset;
  onBack: () => void;
  onLiquidate: (id: string) => void;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({ asset, onBack, onLiquidate }) => {
  const profit = asset.estimatedPrice - asset.purchasePrice;
  const isProfit = profit >= 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
         <TouchableOpacity onPress={onBack} style={styles.iconBtn}><ChevronLeft size={24} color="white" /></TouchableOpacity>
         <TouchableOpacity style={styles.iconBtn}><MoreHorizontal size={24} color="white" /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Hero Image */}
          <View style={styles.imageContainer}>
              <Image source={{ uri: asset.imageBase64 }} style={styles.heroImage} />
              <View style={styles.gradientOverlay} />
              <View style={styles.heroText}>
                  <View style={styles.tagRow}>
                      <View style={styles.tag}><Text style={styles.tagText}>{asset.category}</Text></View>
                      {asset.isAuthentic && <View style={styles.verifiedTag}><ShieldCheck size={12} color="#00FF94" /><Text style={styles.verifiedText}> VERIFIED</Text></View>}
                  </View>
                  <Text style={styles.title}>{asset.itemName}</Text>
              </View>
          </View>

          <View style={styles.contentBody}>
              {/* Stats */}
              <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                      <Text style={styles.statLabel}>MARKET VALUE</Text>
                      <Text style={styles.statValue}>${asset.estimatedPrice.toLocaleString()}</Text>
                  </View>
                  <View style={styles.statCard}>
                      <Text style={styles.statLabel}>UNREALIZED P/L</Text>
                      <Text style={[styles.statValue, { color: isProfit ? '#00FF94' : '#FF3B30' }]}>
                          {isProfit ? '+' : ''}{profit.toLocaleString()}
                      </Text>
                  </View>
              </View>

              {/* Rating */}
              <View style={styles.ratingRow}>
                  <Text style={styles.statLabel}>AI RATING</Text>
                  <View style={styles.ratingBadge}>
                      {asset.investmentRating === 'BUY' && <TrendingUp size={14} color="#00FF94" />}
                      <Text style={[styles.ratingText, { color: asset.investmentRating === 'BUY' ? '#00FF94' : 'white' }]}>
                          {asset.investmentRating}
                      </Text>
                  </View>
              </View>

              {/* Chart */}
              <View style={styles.chartSection}>
                  <View style={styles.chartHeader}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Clock size={14} color="gray" />
                          <Text style={styles.statLabel}>12 MONTH PROJECTION</Text>
                      </View>
                  </View>
                  <FinancialChart data={asset.history} height={200} showPrediction={true} />
              </View>

              {/* Info Block */}
              <View style={styles.infoBlock}>
                  <Text style={styles.infoTitle}>ASSET SPECS</Text>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Condition</Text><Text style={styles.infoVal}>Excellent (AI)</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Acquired</Text><Text style={styles.infoVal}>{new Date(asset.dateAdded).toLocaleDateString()}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Volatility</Text><Text style={{ color: '#FF3B30', fontFamily: 'monospace', fontSize: 12 }}>High</Text></View>
              </View>
          </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
          <View style={styles.holdBtn}><Text style={styles.btnText}>HOLD</Text></View>
          <TouchableOpacity style={styles.liquidateBtn} onPress={() => onLiquidate(asset.id)}>
              <Zap size={18} color="white" />
              <Text style={styles.btnText}>LIQUIDATE</Text>
          </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  scrollContent: { paddingBottom: 100 },
  imageContainer: { height: 400, width: '100%' },
  heroImage: { width: '100%', height: '100%' },
  gradientOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  heroText: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tagText: { color: 'white', fontSize: 10, fontFamily: 'monospace' },
  verifiedTag: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(0,255,148,0.2)', borderRadius: 4, flexDirection: 'row', alignItems: 'center' },
  verifiedText: { color: '#00FF94', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' },
  title: { fontSize: 32, fontWeight: 'bold', color: 'white', fontFamily: 'monospace' },
  contentBody: { padding: 20, marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: 'black' },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 16, backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#222' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace', marginBottom: 4, letterSpacing: 1 },
  statValue: { color: 'white', fontSize: 20, fontWeight: 'bold', fontFamily: 'monospace' },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#111', borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' },
  chartSection: { marginBottom: 20 },
  chartHeader: { marginBottom: 12 },
  infoBlock: { padding: 20, backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#222' },
  infoTitle: { color: 'white', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'monospace' },
  infoVal: { color: 'white', fontSize: 12, fontFamily: 'monospace' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 30, flexDirection: 'row', gap: 12, backgroundColor: 'rgba(0,0,0,0.9)' },
  holdBtn: { flex: 1, height: 56, backgroundColor: '#222', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  liquidateBtn: { flex: 1, height: 56, backgroundColor: '#FF3B30', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnText: { color: 'white', fontWeight: 'bold', fontFamily: 'monospace' }
});