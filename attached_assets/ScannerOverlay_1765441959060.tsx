import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Lock, Wifi } from 'lucide-react-native';

interface ScannerOverlayProps {
    scanStatus: 'SEARCHING' | 'STABILIZING' | 'LOCKED';
    stability: number; 
}

const { width } = Dimensions.get('window');

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({ scanStatus, stability }) => {
  const [now, setNow] = useState(new Date());
  const [iso, setIso] = useState(800);

  useEffect(() => {
    const timer = setInterval(() => {
        setNow(new Date());
        setIso(prev => prev === 800 ? 1600 : 800);
    }, 800);
    return () => clearInterval(timer);
  }, []);

  const isLocked = scanStatus === 'LOCKED';
  const color = isLocked ? '#00FF94' : scanStatus === 'STABILIZING' ? '#FACC15' : 'rgba(255,255,255,0.6)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      
      {/* Top HUD */}
      <View style={styles.topHud}>
        <View>
          <View style={styles.row}>
             <View style={[styles.dot, { backgroundColor: isLocked ? '#00FF94' : '#FF3B30' }]} />
             <Text style={[styles.statusLabel, { color }]}>
                 {isLocked ? 'SIGNAL_CLEAR' : 'ACQUIRING...'}
             </Text>
          </View>
          <Text style={styles.subText}>ISO {iso} • STABILITY {Math.floor(stability)}%</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={styles.row}>
            <Wifi size={12} color="rgba(255,255,255,0.6)" />
            <Text style={styles.statusLabel}> 5G</Text>
          </View>
          <Text style={styles.subText}>LAT: 37.77 • LON: -122.41</Text>
        </View>
      </View>

      {/* Focus Area */}
      <View style={styles.centerContainer}>
        <View style={[
            styles.reticle, 
            { 
                width: isLocked ? 250 : 280, 
                height: isLocked ? 250 : 280,
                borderColor: color 
            }
        ]}>
            {/* Corners */}
            <View style={[styles.corner, styles.tl, { borderColor: color }]} />
            <View style={[styles.corner, styles.tr, { borderColor: color }]} />
            <View style={[styles.corner, styles.bl, { borderColor: color }]} />
            <View style={[styles.corner, styles.br, { borderColor: color }]} />

            {isLocked && <Lock size={32} color="#00FF94" style={{ alignSelf: 'center', marginTop: 100 }} />}
            
            {!isLocked && (
                <View style={styles.crosshair}>
                    <View style={styles.vLine} />
                    <View style={styles.hLine} />
                </View>
            )}
        </View>
      </View>

      {/* Bottom HUD */}
      <View style={styles.bottomHud}>
        <View>
             <Text style={[styles.statusLabel, { color, fontSize: 12 }]}>
                 {scanStatus === 'SEARCHING' ? 'HOLD DEVICE STEADY' : 
                  scanStatus === 'STABILIZING' ? 'CALIBRATING...' : 
                  'READY FOR CAPTURE'}
             </Text>
             <View style={styles.barContainer}>
                <View style={[styles.barFill, { width: `${stability}%`, backgroundColor: color }]} />
             </View>
        </View>
        <Text style={styles.timeText}>
            {now.toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit'})}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topHud: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 60 },
  bottomHud: { position: 'absolute', bottom: 40, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  subText: { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  reticle: { justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 20, height: 20, borderWidth: 2, borderColor: 'white' },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  crosshair: { position: 'absolute', opacity: 0.5 },
  vLine: { width: 1, height: 20, backgroundColor: 'white', alignSelf: 'center' },
  hLine: { height: 1, width: 20, backgroundColor: 'white', position: 'absolute', top: 10, left: -10 },
  barContainer: { height: 2, width: 100, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#00FF94' },
  timeText: { fontFamily: 'monospace', color: 'white', fontSize: 12, fontWeight: 'bold' }
});