import { useAppTheme } from '../state/appearance';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarIcon, type TabBarIconName } from './TabBarIcon';
import { useThemedStyles, type AppTheme } from './theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const tabs: Record<string, { label: string; icon: TabBarIconName }> = {
  discover: { label: '搜索', icon: 'search' },
  index: { label: '书架', icon: 'bookshelf' },
  sources: { label: '书源', icon: 'sources' },
  profile: { label: '我的', icon: 'profile' },
};

export function GlassTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const styles = useThemedStyles(createStyles);
  const { theme, colorScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingBottom: Math.max(insets.bottom, 9) + 5 }]}>
      <View style={styles.pill}>
        {nativeGlass ? (
          <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={colorScheme} style={styles.glassBackground} />
        ) : (
          <BlurView pointerEvents="none" tint={colorScheme === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'} intensity={75} style={styles.glassBackground} />
        )}
        <View pointerEvents="none" style={styles.surfaceTint} />
        <View style={styles.items}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const config = tabs[route.name];
            const options = descriptors[route.key].options;
            if (!config) return null;
            return (
              <Pressable
                key={route.key}
                style={focused ? styles.activeItem : styles.item}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? config.label}
                onPress={() => {
                  const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigateToTab(route.key);
                }}
                onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              >
                <View style={styles.icon}>
                  <TabBarIcon name={config.icon} color={focused ? theme.dark : theme.muted} focused={focused} />
                </View>
                <Text style={[styles.label, focused && styles.activeLabel]}>{config.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 16 },
  pill: { width: '100%', maxWidth: 390, height: 70, borderRadius: 25, borderWidth: 1, borderColor: theme.glassBorder, backgroundColor: theme.paper, shadowColor: '#514B40', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 9, overflow: 'hidden' },
  glassBackground: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 35 },
  surfaceTint: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: theme.glassTint, borderRadius: 25 },
  items: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 2 },
  item: { flex: 1, height: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  activeItem: { flex: 1, height: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: theme.successSoft },
  icon: { width: 24, height: 24, marginBottom: 1 },
  label: { color: theme.muted, fontSize: 10, fontWeight: '600' },
  activeLabel: { color: theme.dark, fontWeight: '700' },
});
