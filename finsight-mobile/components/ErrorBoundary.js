import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log silently — could send to a crash reporting service later
    console.error('[FinSight Crash]', error?.message, info?.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Text style={s.emoji}>⚠️</Text>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.subtitle}>
            FinSight hit an unexpected error. Your data is safe — tap below to recover.
          </Text>

          <ScrollView style={s.errorBox} contentContainerStyle={{ padding: 12 }}>
            <Text style={s.errorText}>
              {this.state.error?.message || 'Unknown error'}
            </Text>
          </ScrollView>

          <TouchableOpacity style={s.btn} onPress={() => this.handleReset()}>
            <Text style={s.btnText}>↩ Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0E120F',
    justifyContent: 'center', alignItems: 'center',
    padding: 32,
  },
  emoji:    { fontSize: 52, marginBottom: 16 },
  title:    { color: '#F5F3EE', fontSize: 22, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  subtitle: { color: '#6B7069', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  errorBox: {
    backgroundColor: '#1A1E18', borderRadius: 12,
    maxHeight: 120, width: '100%', marginBottom: 28,
  },
  errorText: { color: '#E54545', fontSize: 12, fontFamily: 'monospace' },
  btn: {
    backgroundColor: '#B4DC2A', borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  btnText: { color: '#0E120F', fontWeight: '900', fontSize: 16 },
});

export default ErrorBoundary;
