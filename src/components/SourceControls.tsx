import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

export function SourceButton({ children, onPress, disabled = false, secondary = false, danger = false, label }: PropsWithChildren<{
  onPress(): void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  label?: string;
}>) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && styles.danger, (disabled || pressed) && styles.dimmed]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText, danger && styles.dangerText]}>{children}</Text>
    </Pressable>
  );
}

export function SourceMessage({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return <View style={[styles.message, error && styles.errorMessage]}><Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.messageText, error && styles.errorText]}>{children}</Text></View>;
}

export const sourceStyles = StyleSheet.create({
  label: { color: theme.ink, fontSize: 14, fontWeight: '700', marginBottom: 9 },
  helper: { color: theme.muted, fontSize: 12, lineHeight: 20, marginBottom: 16 },
  input: { minHeight: 50, backgroundColor: theme.paper, color: theme.ink, borderRadius: 12, borderWidth: 1, borderColor: theme.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 20 },
  editor: { minHeight: 240, fontSize: 12, lineHeight: 19, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: { backgroundColor: theme.paper, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.line, marginBottom: 14 },
  sectionTitle: { color: theme.ink, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 12, marginBottom: 18 },
  switchCopy: { flex: 1 },
  switchLabel: { color: theme.ink, fontSize: 14, fontWeight: '700', marginBottom: 5 },
  switchHint: { color: theme.muted, fontSize: 12, lineHeight: 19 },
});

const styles = StyleSheet.create({
  button: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.dark, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.dark },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  secondary: { backgroundColor: theme.paper, borderColor: theme.line },
  secondaryText: { color: theme.ink },
  danger: { backgroundColor: '#FBEDE9', borderColor: '#F2D4CC' },
  dangerText: { color: '#A44132' },
  dimmed: { opacity: 0.45 },
  message: { backgroundColor: '#EAF0E9', padding: 14, borderRadius: 12, marginBottom: 16 },
  messageText: { color: '#3B6046', fontSize: 13, lineHeight: 20 },
  errorMessage: { backgroundColor: '#FBEDE9' },
  errorText: { color: '#A44132' },
});
