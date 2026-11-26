import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles, type AppTheme } from './theme';

export function Page({ title, eyebrow, children }: PropsWithChildren<{ title: string; eyebrow?: string }>) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 22 }]} keyboardShouldPersistTaps="handled">
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
  content: { paddingHorizontal: 20, paddingBottom: 130, maxWidth: 760, width: '100%', alignSelf: 'center' },
  heading: { marginBottom: 24 },
  eyebrow: { color: theme.accent, fontSize: 12, fontWeight: '700', letterSpacing: 3, marginBottom: 8 },
  title: { color: theme.ink, fontSize: 31, fontWeight: '800', letterSpacing: 1 },
});
