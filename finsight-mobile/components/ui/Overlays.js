import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  AccessibilityInfo, Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, radius, space } from '../../constants/tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';
import { useReducedMotion, useTheme } from './theme';

// How far the keyboard covers a full-screen view on Android, where edge-to-edge
// windows don't shrink for it. Any shrink that did happen is taken off, so a phone
// that does resize the window isn't pushed up twice.
function useKeyboardOverlap() {
  const [keyboard, setKeyboard] = useState(() => (Platform.OS === 'android' ? Keyboard.metrics()?.height || 0 : 0));
  const [height, setHeight] = useState(0);
  const tallest = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', e => setKeyboard(e.endCoordinates.height)),
      Keyboard.addListener('keyboardDidHide', () => setKeyboard(0)),
    ];
    return () => subscriptions.forEach(s => s.remove());
  }, []);

  const onLayout = useCallback(e => {
    const next = e.nativeEvent.layout.height;
    tallest.current = Math.max(tallest.current, next);
    setHeight(next);
  }, []);

  return { overlap: Math.max(keyboard - (tallest.current - height), 0), height, onLayout };
}

// Bottom sheet, used in place of alerts and full-screen popups. The Modal stays
// mounted through the closing animation, so the sheet slides away smoothly.
export function Sheet({ visible, onClose, title, children, footer }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const { overlap, height, onLayout } = useKeyboardOverlap();

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduced ? 0 : motion.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible, reduced, progress]);

  if (!mounted) return null;
  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        onLayout={onLayout}
        style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: overlap }}
      >
        <Animated.View style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
          backgroundColor: c.scrim, opacity: progress,
        }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
            paddingHorizontal: space.lg, paddingTop: space.sm,
            paddingBottom: Math.max(insets.bottom, space.lg),
            maxHeight: height ? (height - overlap) * 0.9 : '90%',
            width: '100%', maxWidth: 560, alignSelf: 'center',
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }],
          }}
        >
          <View style={{
            alignSelf: 'center', width: 36, height: 4, borderRadius: radius.pill,
            backgroundColor: c.lineStrong, marginBottom: space.md,
          }} />
          {title ? <Text variant="heading" accessibilityRole="header" style={{ marginBottom: space.md }}>{title}</Text> : null}
          {children}
          {footer ? <View style={{ marginTop: space.lg, gap: space.sm }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Replaces Alert.alert for yes/no decisions. Say what happens in confirmLabel,
// such as "Delete transaction", never just "OK".
export function ConfirmSheet({
  visible, title, body, confirmLabel, cancelLabel = 'Cancel', destructive, onConfirm, onCancel,
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={title}
      footer={(
        <>
          <Button full title={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} />
          <Button full title={cancelLabel} variant="ghost" onPress={onCancel} />
        </>
      )}
    >
      {body ? <Text color="inkMuted">{body}</Text> : null}
    </Sheet>
  );
}

const ToastContext = createContext({ show: () => {} });
export const useToast = () => useContext(ToastContext);

const TOAST_MS = 3200;

// show('Backup finished') or show('Could not save', { tone: 'error' })
export function ToastProvider({ children }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [toast, setToast] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const hide = useCallback(() => {
    Animated.timing(progress, { toValue: 0, duration: reduced ? 0 : motion.base, useNativeDriver: true })
      .start(({ finished }) => { if (finished) setToast(null); });
  }, [progress, reduced]);

  const show = useCallback((message, { tone = 'default' } = {}) => {
    clearTimeout(timer.current);
    setToast({ message, tone });
    AccessibilityInfo.announceForAccessibility?.(message);
    Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : motion.base, useNativeDriver: true }).start();
    timer.current = setTimeout(hide, TOAST_MS);
  }, [hide, progress, reduced]);

  useEffect(() => () => clearTimeout(timer.current), []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute', left: space.lg, right: space.lg,
            bottom: Math.max(insets.bottom, space.lg) + 72,
            alignItems: 'center',
            opacity: progress,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }}
        >
          <Pressable
            onPress={hide}
            accessibilityRole="alert"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: 480,
              paddingHorizontal: space.lg, paddingVertical: space.md,
              borderRadius: radius.md, backgroundColor: c.inverse,
            }}
          >
            {toast.tone === 'error' ? <Icon name="alert-circle-outline" size={18} color="onInverse" /> : null}
            {toast.tone === 'success' ? <Icon name="checkmark-circle-outline" size={18} color="onInverse" /> : null}
            <Text variant="label" color="onInverse" style={{ flexShrink: 1 }}>{toast.message}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}
