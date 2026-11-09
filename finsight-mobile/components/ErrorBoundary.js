/* global __DEV__ */
import React from 'react';
import * as Sentry from '@sentry/react-native';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily } from '../constants/tokens';

// Always the dark FinSight colours: this screen shows when something has failed, so it
// can't rely on the theme or anything else that might be the cause.
const c = colors.dark;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Reported with the component path only; the privacy filter strips the rest.
    Sentry.captureException(error, { contexts: { react: { componentStack: info?.componentStack } } });
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={c.canvas} />
        <View style={s.iconWrap} importantForAccessibility="no" accessibilityElementsHidden>
          <Ionicons name="alert-circle-outline" size={36} color={c.accent} />
        </View>
        <Text style={s.title} accessibilityRole="header">Something went wrong</Text>
        <Text style={s.body}>
          FinSight hit a problem and has sent us a report, with no personal details. Your money data is safe on this phone.
        </Text>
        {/* The technical message only helps while building the app, so users never see it. */}
        {__DEV__ && this.state.error?.message ? (
          <Text style={s.dev} selectable>{this.state.error.message}</Text>
        ) : null}
        <Pressable
          onPress={() => this.handleReset()}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => [s.button, pressed && { backgroundColor: c.accentPressed }]}
        >
          <Text style={s.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.canvas, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { color: c.ink, fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 30, textAlign: 'center' },
  body: { color: c.inkMuted, fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  dev: { color: c.negative, fontSize: 12, textAlign: 'center' },
  button: { marginTop: 16, minHeight: 48, minWidth: 180, paddingHorizontal: 28, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: c.onAccent, fontFamily: fontFamily.semibold, fontSize: 16 },
});

export default ErrorBoundary;
