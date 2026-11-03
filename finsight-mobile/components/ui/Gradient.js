import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../../constants/tokens';

const DIAGONAL = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };

// style sizes it; with `fill` it covers its parent, for buttons and cards.
export function Gradient({ name = 'warm', fill, style, children, ...rest }) {
  return (
    <LinearGradient
      colors={gradients[name]}
      {...DIAGONAL}
      pointerEvents={fill ? 'none' : undefined}
      style={[fill && StyleSheet.absoluteFill, style]}
      {...rest}
    >
      {children}
    </LinearGradient>
  );
}
