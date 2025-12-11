import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Image, 
  Alert, 
  StatusBar, 
  ActivityIndicator, 
  TouchableOpacity,
  Text,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RefreshCw, Check } from 'lucide-react-native';

// Services & Types
import { analyzeImage, generateAssetVideo } from './services/geminiService';
import { AppState, AssetData, PortfolioAsset } from './types';

// Components
import { Dashboard } from './components/Dashboard';
import { ScannerOverlay } from './components/ScannerOverlay';
import { ResultCard } from './components/ResultCard';
import { AssetDetail } from './components/AssetDetail';

// Constants
const PORTFOLIO_STORAGE_KEY = 'scope_portfolio_mobile_v1';
const THEME = {
  black: '#000000',
  green: '#00FF94',
  textDim: 'rgba(255, 255, 255, 0.6)',
};

// Safety Wrapper for Haptics
const safeHaptics = {
    selection: () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); },
    success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
    warning: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
    heavy: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); },
};

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  
  // App State
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<PortfolioAsset | null>(null);
  const [scanResult, setScanResult] = useState<AssetData | null>(null);
  
  // Camera & Capture
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stability, setStability] = useState<number>(0);
  const [scanStatus, setScanStatus] = useState<'SEARCHING' | 'STABILIZING' | 'LOCKED'>('SEARCHING');
  
  // UI State
  const [analysisStep, setAnalysisStep] = useState<string>("INITIALIZING...");
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // --- Load Portfolio ---
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(PORTFOLIO_STORAGE_KEY);
        if (saved) setPortfolio(JSON.parse(saved));
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolio));
  }, [portfolio]);

  // --- Accelerometer for Stability ---
  useEffect(() => {
    if (appState !== AppState.SCANNING) return;

    // Platform check for web
    if (Platform.OS === 'web') {
        // Mock stability on web
        const timer = setTimeout(() => setStability(100), 500);
        return () => clearTimeout(timer);
    }

    let lastData = { x: 0, y: 0, z: 0 };
    Accelerometer.setUpdateInterval(100);
    
    const subscription = Accelerometer.addListener(data => {
      const delta = Math.abs(data.x - lastData.x) + Math.abs(data.y - lastData.y) + Math.abs(data.z - lastData.z);
      lastData = data;
      // Delta near 0 means stable. Map delta (0.0 to 0.5) to stability (100 to 0)
      const stabilityScore = Math.max(0, Math.min(100, (1 - delta * 5) * 100));
      setStability(prev => (prev * 0.7) + (stabilityScore * 0.3));
    });

    return () => subscription.remove();
  }, [appState]);

  // --- Stability Logic ---
  useEffect(() => {
    const prevStatus = scanStatus;
    let newStatus: typeof scanStatus = 'SEARCHING';
    if (stability > 85) newStatus = 'LOCKED';
    else if (stability > 50) newStatus = 'STABILIZING';

    if (newStatus !== prevStatus) {
      setScanStatus(newStatus);
      if (newStatus === 'LOCKED') safeHaptics.heavy();
    }
  }, [stability]);

  // --- Analysis Simulation ---
  useEffect(() => {
    if (appState === AppState.ANALYZING) {
      const steps = ["EXTRACTING DATA...", "MAPPING GEOMETRY...", "CHECKING ID...", "VERIFYING MARKET...", "CALCULATING VALUE..."];
      let i = 0;
      setAnalysisStep(steps[0]);
      const int = setInterval(() => {
        i++;
        if (i < steps.length) setAnalysisStep(steps[i]);
      }, 700);
      return () => clearInterval(int);
    }
  }, [appState]);

  // --- Handlers ---
  const startScanning = async () => {
    if (Platform.OS === 'web') {
         // Web permission handling handled by browser
    } else {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert("Permission Required", "Camera access is needed to scan items.");
                return;
            }
        }
    }
    setAppState(AppState.SCANNING);
    setStability(0);
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    safeHaptics.selection();
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.8 });
      if (photo?.base64) {
        setCapturedImage(`data:image/jpeg;base64,${photo.base64}`);
        setAppState(AppState.REVIEW);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to capture image");
    }
  };

  const confirmAnalysis = async () => {
    if (!capturedImage) return;
    safeHaptics.success();
    setAppState(AppState.ANALYZING);
    try {
      const result = await analyzeImage([capturedImage]);
      setScanResult(result);
      setAppState(AppState.RESULT);
    } catch (e) {
      setAppState(AppState.REVIEW);
      Alert.alert("Analysis Failed", "Could not identify object. Try again.");
    }
  };

  const handleGenerateVideo = async () => {
    if (!capturedImage || !scanResult) return;
    safeHaptics.selection();
    setIsGeneratingVideo(true);
    try {
      const url = await generateAssetVideo(capturedImage, scanResult.itemName);
      setVideoUrl(url);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const addToPortfolio = () => {
    if (!scanResult || !capturedImage) return;
    const newAsset: PortfolioAsset = {
      ...scanResult,
      id: `asset-${Date.now()}`,
      dateAdded: new Date().toISOString(),
      purchasePrice: scanResult.estimatedPrice,
      isAuthentic: scanResult.confidenceScore > 80,
      history: Array(7).fill(0).map(() => scanResult.estimatedPrice * (0.95 + Math.random() * 0.1)),
      imageBase64: capturedImage
    };
    setPortfolio(prev => [newAsset, ...prev]);
    setAppState(AppState.HOME);
    setVideoUrl(null);
  };

  const handleSelectAsset = (asset: PortfolioAsset) => {
    setSelectedAsset(asset);
    setAppState(AppState.ASSET_DETAIL);
  };

  const handleLiquidate = (id: string) => {
    setPortfolio(prev => prev.filter(p => p.id !== id));
    setAppState(AppState.HOME);
    safeHaptics.warning();
  };

  // --- RENDERERS ---

  if (appState === AppState.HOME) {
    return (
      <Dashboard 
        assets={portfolio} 
        onScan={startScanning} 
        onSelectAsset={handleSelectAsset} 
      />
    );
  }

  if (appState === AppState.SCANNING) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <CameraView 
            style={StyleSheet.absoluteFill} 
            ref={cameraRef} 
            facing="back"
            animateShutter={false} 
        />
        <ScannerOverlay scanStatus={scanStatus} stability={stability} />
        
        {/* Controls */}
        <View style={styles.scanControls}>
            <TouchableOpacity onPress={() => setAppState(AppState.HOME)} style={styles.backBtn}>
                 <Text style={{color:'white', fontWeight:'bold'}}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
                <View style={[styles.captureInner, scanStatus === 'LOCKED' && { backgroundColor: THEME.green }]} />
            </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (appState === AppState.REVIEW) {
    return (
      <View style={styles.container}>
        {capturedImage && <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFill} resizeMode="contain" />}
        <View style={styles.reviewOverlay}>
           <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAppState(AppState.SCANNING)}>
              <RefreshCw color="white" size={20} />
              <Text style={styles.btnText}>RETAKE</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.primaryBtn} onPress={confirmAnalysis}>
              <Check color="black" size={20} />
              <Text style={styles.btnTextPrimary}>ANALYZE</Text>
           </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (appState === AppState.ANALYZING) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={THEME.green} />
        <Text style={styles.analyzingText}>{analysisStep}</Text>
      </View>
    );
  }

  if (appState === AppState.RESULT && scanResult) {
    return (
      <View style={styles.container}>
         <Dashboard assets={portfolio} onScan={startScanning} onSelectAsset={handleSelectAsset} />
         <ResultCard 
            data={scanResult}
            onClose={() => setAppState(AppState.HOME)}
            onGenerateVideo={handleGenerateVideo}
            onSave={addToPortfolio}
            isGeneratingVideo={isGeneratingVideo}
            videoUrl={videoUrl}
         />
      </View>
    );
  }

  if (appState === AppState.ASSET_DETAIL && selectedAsset) {
    return (
      <AssetDetail 
        asset={selectedAsset} 
        onBack={() => setAppState(AppState.HOME)} 
        onLiquidate={handleLiquidate} 
      />
    );
  }

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  scanControls: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center', justifyContent: 'center' },
  captureBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'white', padding: 4, alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: '100%', height: '100%', borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  backBtn: { position: 'absolute', left: 30, bottom: 25 },
  reviewOverlay: { position: 'absolute', bottom: 0, width: '100%', padding: 30, flexDirection: 'row', gap: 16, backgroundColor: 'rgba(0,0,0,0.8)' },
  primaryBtn: { flex: 1, height: 50, backgroundColor: THEME.green, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryBtn: { flex: 1, height: 50, backgroundColor: '#333', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: 'white', fontWeight: 'bold' },
  btnTextPrimary: { color: 'black', fontWeight: 'bold' },
  analyzingText: { color: THEME.green, marginTop: 20, fontFamily: 'monospace', letterSpacing: 2 },
});