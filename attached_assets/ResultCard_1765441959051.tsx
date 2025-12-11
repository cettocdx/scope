import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Dimensions, Linking } from 'react-native';
import { AssetData } from '../types';
import { Share2, X, Clapperboard, PlusCircle, Globe, ExternalLink, Tag } from 'lucide-react-native';

interface ResultCardProps {
  data: AssetData;
  onClose: () => void;
  onGenerateVideo: () => void;
  onSave: () => void;
  isGeneratingVideo: boolean;
  videoUrl: string | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ResultCard: React.FC<ResultCardProps> = ({ 
  data, 
  onClose, 
  onGenerateVideo,
  onSave,
  isGeneratingVideo,
  videoUrl
}) => {
  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <Modal animationType="slide" transparent={true} visible={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.cardContainer}>
          
          {/* Drag Handle */}
          <View style={styles.handleContainer}>
             <View style={styles.handle} />
          </View>

          <View style={styles.header}>
              <View style={{ flex: 1 }}>
                  <View style={styles.tagRow}>
                      <View style={styles.catTag}><Text style={styles.catText}>{data.category}</Text></View>
                      {data.confidenceScore > 85 && (
                          <View style={styles.matchTag}>
                              <Text style={styles.matchText}>99% MATCH</Text>
                          </View>
                      )}
                  </View>
                  <Text style={styles.title} numberOfLines={2}>{data.itemName}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color="white" />
              </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
              
              {/* Price Section */}
              <View style={styles.priceRow}>
                  <Text style={styles.price}>${data.estimatedPrice.toLocaleString()}</Text>
                  <View style={[styles.trendBadge, { backgroundColor: data.trendPercentage >= 0 ? 'rgba(0, 255, 148, 0.2)' : 'rgba(255, 59, 48, 0.2)' }]}>
                      <Text style={[styles.trendText, { color: data.trendPercentage >= 0 ? '#00FF94' : '#FF3B30' }]}>
                          {data.trendPercentage > 0 ? '+' : ''}{data.trendPercentage}% (24H)
                      </Text>
                  </View>
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={onSave}>
                      <PlusCircle size={18} color="black" />
                      <Text style={styles.primaryBtnText}>ADD TO VAULT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.secondaryBtn} 
                    onPress={onGenerateVideo}
                    disabled={isGeneratingVideo}
                  >
                      <Clapperboard size={18} color="white" />
                      <Text style={styles.secondaryBtnText}>{isGeneratingVideo ? 'GENERATING...' : 'CREATE AD'}</Text>
                  </TouchableOpacity>
              </View>

              {/* Markets */}
              <Text style={styles.sectionTitle}>GLOBAL MARKETS</Text>
              
              {data.deals?.map((deal, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.dealCard}
                    onPress={() => openLink(deal.url)}
                  >
                      <View>
                          <Text style={styles.storeName}>{deal.storeName}</Text>
                          {deal.isBestDeal && <Text style={styles.bestDealText}>BEST PRICE</Text>}
                      </View>
                      <View style={styles.dealRight}>
                          <Text style={styles.dealPrice}>${deal.price.toLocaleString()}</Text>
                          <ExternalLink size={14} color="#666" />
                      </View>
                  </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.shareBtn}>
                  <Share2 size={14} color="#666" />
                  <Text style={styles.shareText}>SHARE REPORT</Text>
              </TouchableOpacity>

              <View style={{height: 50}} />
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  cardContainer: { backgroundColor: '#0F0F0F', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: SCREEN_HEIGHT * 0.85, paddingBottom: 40 },
  handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 50, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 20 },
  closeBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  catTag: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 },
  catText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'monospace' },
  matchTag: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(0,255,148,0.1)', borderRadius: 4 },
  matchText: { color: '#00FF94', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' },
  title: { color: 'white', fontSize: 24, fontWeight: 'bold', fontFamily: 'monospace' },
  scrollContent: { paddingHorizontal: 24 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 30 },
  price: { color: 'white', fontSize: 42, fontWeight: 'bold' },
  trendBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  trendText: { fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 30 },
  primaryBtn: { flex: 1, height: 56, backgroundColor: 'white', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: 'black', fontWeight: 'bold', fontFamily: 'monospace' },
  secondaryBtn: { flex: 1, height: 56, backgroundColor: '#222', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#333' },
  secondaryBtnText: { color: 'white', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 12 },
  sectionTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace', marginBottom: 12, letterSpacing: 1 },
  dealCard: { backgroundColor: '#141414', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  storeName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  bestDealText: { color: '#00FF94', fontSize: 10, fontFamily: 'monospace', marginTop: 4 },
  dealRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dealPrice: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  shareBtn: { flexDirection: 'row', alignSelf: 'center', marginTop: 20, gap: 8 },
  shareText: { color: '#666', fontSize: 12, fontFamily: 'monospace' }
});