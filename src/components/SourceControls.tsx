import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles, type AppTheme } from './theme';

export function SourceButton({ children, onPress, disabled = false, secondary = false, danger = false, label, style }: PropsWithChildren<{
  onPress(): void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}>) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && styles.danger, style, (disabled || pressed) && styles.dimmed]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText, danger && styles.dangerText]}>{children}</Text>
    </Pressable>
  );
}

export function SourceMessage({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.message, error && styles.errorMessage]}><Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.messageText, error && styles.errorText]}>{children}</Text></View>;
}

export function useSourceStyles() {
  return useThemedStyles(createSourceStyles);
}

const createSourceStyles = (theme: AppTheme) => StyleSheet.create({
  label: { color: theme.ink, fontSize: 14, fontWeight: '600', marginBottom: 9 },
  helper: { color: theme.muted, fontSize: 12, lineHeight: 21, marginBottom: 16 },
  input: { minHeight: 50, backgroundColor: theme.paper, color: theme.ink, borderRadius: 12, borderWidth: 1, borderColor: theme.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 20 },
  editor: { minHeight: 240, fontSize: 12, lineHeight: 19, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: { backgroundColor: theme.paper, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.line, marginBottom: 14 },
  sectionTitle: { color: theme.ink, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 12, marginBottom: 18 },
  switchCopy: { flex: 1 },
  switchLabel: { color: theme.ink, fontSize: 14, fontWeight: '700', marginBottom: 5 },
  switchHint: { color: theme.muted, fontSize: 12, lineHeight: 19 },
});

const createStyles = (theme: AppTheme) => StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 13, backgroundColor: theme.dark, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.dark },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  secondary: { backgroundColor: theme.paper, borderColor: theme.line },
  secondaryText: { color: theme.ink },
  danger: { backgroundColor: theme.dangerSoft, borderColor: theme.dangerLine },
  dangerText: { color: theme.danger },
  dimmed: { opacity: 0.45 },
  message: { backgroundColor: theme.successSoft, padding: 14, borderRadius: 12, marginBottom: 16 },
  messageText: { color: theme.success, fontSize: 13, lineHeight: 20 },
  errorMessage: { backgroundColor: theme.dangerSoft },
  errorText: { color: theme.danger },
});
