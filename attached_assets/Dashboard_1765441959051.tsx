import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { PortfolioAsset } from '../types';
import { FinancialChart } from './FinancialChart';
import { Scan, ChevronLeft, ShieldCheck, Wallet, ArrowRight, Layers, Aperture, TrendingUp } from 'lucide-react-native';

interface DashboardProps {
  assets: PortfolioAsset[];
  onScan: () => void;
  onSelectAsset: (asset: PortfolioAsset) => void;
}

const { width } = Dimensions.get('window');

export const Dashboard: React.FC<DashboardProps> = ({ assets, onScan, onSelectAsset }) => {
  const [viewMode, setViewMode] = useState<'LANDING' | 'VAULT'>('LANDING');
  const totalValue = assets.reduce((acc, curr) => acc + curr.estimatedPrice, 0);

  // Simple mock data for chart
  const historyData = [100, 102, 105, 103, 108, 112, 115, 118, 120, 125];

  if (viewMode === 'VAULT') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.vaultHeader}>
            <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => setViewMode('LANDING')} style={styles.backBtn}>
                    <ChevronLeft size={24} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.label}>NET WORTH</Text>
                    <Text style={styles.netWorth}>${totalValue.toLocaleString()}</Text>
                </View>
            </View>
            <FinancialChart data={historyData} height={80} color="#00FF94" showPrediction={false} />
        </View>

        <ScrollView contentContainerStyle={styles.listContent}>
            <View style={styles.listHeader}>
                <Text style={styles.label}>HOLDINGS</Text>
                <Text style={styles.activeCount}>{assets.length} ACTIVE</Text>
            </View>

            {assets.map((asset) => (
                <TouchableOpacity 
                    key={asset.id} 
                    style={styles.assetCard}
                    onPress={() => onSelectAsset(asset)}
                >
                    <Image source={{ uri: asset.imageBase64 }} style={styles.assetImage} />
                    <View style={styles.assetInfo}>
                        <View>
                            <Text style={styles.assetName} numberOfLines={1}>{asset.itemName}</Text>
                            <Text style={styles.assetCat}>{asset.category}</Text>
                        </View>
                        <View style={styles.assetStats}>
                            <Text style={styles.assetPrice}>${asset.estimatedPrice.toLocaleString()}</Text>
                            <View style={[styles.trendPill, { backgroundColor: asset.trendPercentage >= 0 ? 'rgba(0,255,148,0.1)' : 'rgba(255,59,48,0.1)' }]}>
                                <Text style={{ color: asset.trendPercentage >= 0 ? '#00FF94' : '#FF3B30', fontSize: 10, fontWeight: 'bold' }}>
                                    {asset.trendPercentage > 0 ? '+' : ''}{asset.trendPercentage}%
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            ))}

            {assets.length === 0 && (
                <View style={styles.emptyState}>
                    <View style={styles.iconCircle}>
                        <Wallet size={24} color="rgba(255,255,255,0.2)" />
                    </View>
                    <Text style={styles.emptyText}>VAULT IS EMPTY</Text>
                </View>
            )}
        </ScrollView>

        <View style={styles.fabContainer}>
            <TouchableOpacity onPress={onScan} style={styles.fab}>
                <Scan size={24} color="black" />
            </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { padding: 30, justifyContent: 'space-between' }]}>
        <View style={{ marginTop: 60 }}>
            <View style={styles.statusRow}>
                <View style={styles.dot} />
                <Text style={styles.statusText}>SYSTEM_READY</Text>
            </View>
            <Text style={styles.versionText}>V1.0.4 NATIVE</Text>
        </View>

        <View>
            <Text style={styles.heroTitle}>SCO<Text style={{color: '#333'}}>P</Text>E</Text>
            <View style={styles.divider} />
            <Text style={styles.heroSub}>Identify. Analyze. Capitalize.</Text>
            
            <View style={styles.pillRow}>
                <View style={styles.pill}><Aperture size={12} color="#00FF94" /><Text style={styles.pillText}>VISION</Text></View>
                <View style={styles.pill}><Layers size={12} color="#60A5FA" /><Text style={styles.pillText}>DEPTH</Text></View>
                <View style={styles.pill}><TrendingUp size={12} color="#C084FC" /><Text style={styles.pillText}>PREDICT</Text></View>
            </View>
        </View>

        <View style={{ gap: 16, marginBottom: 30 }}>
            <TouchableOpacity style={styles.mainBtn} onPress={onScan}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                    <Scan size={20} color="black" />
                    <Text style={styles.mainBtnText}>INITIALIZE SCANNER</Text>
                </View>
                <ArrowRight size={20} color="black" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.vaultBtn} onPress={() => setViewMode('VAULT')}>
                <Text style={styles.vaultBtnText}>ACCESS VAULT</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{assets.length}</Text></View>
            </TouchableOpacity>
        </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  vaultHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'rgba(20,20,20,0.9)', borderBottomWidth: 1, borderColor: '#222' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: 2 },
  netWorth: { fontSize: 24, fontWeight: 'bold', color: 'white', fontFamily: 'monospace' },
  listContent: { padding: 20, paddingBottom: 100 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  activeCount: { fontSize: 10, color: '#00FF94', fontFamily: 'monospace' },
  assetCard: { flexDirection: 'row', backgroundColor: '#0A0A0A', borderRadius: 16, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  assetImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#222' },
  assetInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  assetName: { color: 'white', fontWeight: 'bold', fontFamily: 'monospace' },
  assetCat: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' },
  assetStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assetPrice: { color: 'white', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 16 },
  trendPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  emptyState: { height: 200, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222', borderRadius: 16, borderStyle: 'dashed' },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'monospace' },
  fabContainer: { position: 'absolute', bottom: 40, alignSelf: 'center' },
  fab: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', shadowColor: 'white', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  
  // Landing
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FF94' },
  statusText: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: 2 },
  versionText: { fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginTop: 4 },
  heroTitle: { fontSize: 64, fontWeight: '900', color: 'white', fontFamily: 'monospace', letterSpacing: -2 },
  divider: { width: 40, height: 1, backgroundColor: '#00FF94', marginVertical: 16 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontFamily: 'monospace' },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 30 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pillText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' },
  mainBtn: { height: 64, backgroundColor: 'white', borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24 },
  mainBtnText: { color: 'black', fontWeight: 'bold', fontFamily: 'monospace' },
  vaultBtn: { height: 56, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  vaultBtnText: { color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: 12 },
  countBadge: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 },
  countText: { color: 'white', fontSize: 10, fontWeight: 'bold' }
});