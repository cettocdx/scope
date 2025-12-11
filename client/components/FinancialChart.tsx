import React from "react";
import { View, Dimensions } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Line } from "react-native-svg";

import { Colors } from "@/constants/theme";

interface FinancialChartProps {
  data: number[];
  color?: string;
  height?: number;
  showPrediction?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function FinancialChart({
  data,
  color = Colors.dark.successGreen,
  height = 200,
  showPrediction = false,
}: FinancialChartProps) {
  const values = data.length > 0 ? data : [0, 0];
  const min = Math.min(...values) * 0.95;
  const max = Math.max(...values) * 1.05;
  const range = max - min || 1;

  const chartWidth = SCREEN_WIDTH - 48;

  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * chartWidth;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const fillPathD = `${pathD} L ${chartWidth},${height} L 0,${height} Z`;

  const lastPoint = points[points.length - 1].split(",");
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  return (
    <View style={{ height, width: "100%", marginVertical: 10 }}>
      <Svg height={height} width="100%">
        <Defs>
          <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Line
          x1="0"
          y1={height / 2}
          x2="100%"
          y2={height / 2}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeDasharray="4 4"
        />

        <Path d={fillPathD} fill="url(#chartGrad)" />
        <Path d={pathD} stroke={color} strokeWidth="2.5" fill="none" />

        {showPrediction && (
          <Path
            d={`M ${lastX},${lastY} L ${chartWidth},${height * 0.2}`}
            stroke="#00FFFF"
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.6"
          />
        )}
      </Svg>
    </View>
  );
}
