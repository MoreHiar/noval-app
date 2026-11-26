import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles, type AppTheme } from './theme';

export function Page({ title, eyebrow, tabbed = false, children }: PropsWithChildren<{ title: string; eyebrow?: string; tabbed?: boolean }>) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: tabbed ? Math.max(insets.bottom + 116, 130) : Math.max(insets.bottom + 36, 52) }]} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: 24, maxWidth: 760, width: '100%', alignSelf: 'center' },
  heading: { marginBottom: 26 },
  eyebrow: { color: theme.muted, fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  title: { color: theme.ink, fontSize: 27, lineHeight: 36, fontWeight: '700' },
});
