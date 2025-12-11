import React from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';

interface FinancialChartProps {
  data: number[];
  color?: string;
  height?: number;
  showPrediction?: boolean; 
  showComparison?: boolean; 
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const FinancialChart: React.FC<FinancialChartProps> = ({ 
  data, 
  color = '#00FF94', 
  height = 200,
  showPrediction = true
}) => {
  // Simple normalization logic
  const values = data.length > 0 ? data : [0, 0];
  const min = Math.min(...values) * 0.95;
  const max = Math.max(...values) * 1.05;
  const range = max - min || 1;
  
  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * (SCREEN_WIDTH - 48); // 48 is padding
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  
  // Fill path for gradient
  const fillPathD = `${pathD} L ${points[points.length-1].split(',')[0]},${height} L 0,${height} Z`;

  return (
    <View style={{ height, width: '100%', marginVertical: 10 }}>
       <Svg height={height} width="100%">
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.3" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          
          {/* Grid Lines */}
          <Line x1="0" y1={height/2} x2="100%" y2={height/2} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
          
          {/* Area Fill */}
          <Path d={fillPathD} fill="url(#grad)" />
          
          {/* Main Line */}
          <Path d={pathD} stroke={color} strokeWidth="2.5" fill="none" />
          
          {/* Prediction Dashed Line (Mock) */}
          {showPrediction && (
             <Path 
                d={`M ${points[points.length-1]} L ${SCREEN_WIDTH},${height * 0.2}`} 
                stroke="#00FFFF" 
                strokeWidth="2" 
                strokeDasharray="4 4" 
                opacity="0.6"
             />
          )}
       </Svg>
    </View>
  );
};