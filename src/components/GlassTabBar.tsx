import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { ComponentProps, useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarIcon, type TabBarIconName } from './TabBarIcon';
import { theme } from './theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const tabs: Record<string, { label: string; icon: TabBarIconName }> = {
  discover: { label: '搜索', icon: 'search' },
  index: { label: '书架', icon: 'bookshelf' },
  sources: { label: '书源', icon: 'sources' },
  profile: { label: '我的', icon: 'profile' },
};

export function GlassTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [pillWidth, setPillWidth] = useState(350);
  const [lensPosition] = useState(() => new Animated.Value(state.index));
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const itemWidth = (pillWidth - 20) / state.routes.length;

  useEffect(() => {
    Animated.spring(lensPosition, { toValue: state.index, friction: 8, tension: 80, useNativeDriver: true }).start();
  }, [lensPosition, state.index]);

  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingBottom: Math.max(insets.bottom, 9) + 5 }]}>
      <View style={styles.pill} onLayout={(event) => setPillWidth(event.nativeEvent.layout.width)}>
        {nativeGlass ? (
          <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme="light" style={styles.glassBackground} />
        ) : (
          <BlurView pointerEvents="none" tint="systemUltraThinMaterialLight" intensity={75} style={styles.glassBackground} />
        )}
        <View pointerEvents="none" style={styles.surfaceTint} />
        <View pointerEvents="none" style={styles.topHighlight} />
        <Animated.View pointerEvents="none" style={[styles.activeLens, { width: itemWidth, transform: [{ translateX: Animated.multiply(lensPosition, itemWidth + 2) }] }]}>
          {nativeGlass ? <GlassView glassEffectStyle="clear" colorScheme="light" style={styles.lensGlass} /> : <View style={styles.lensFill} />}
        </Animated.View>
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
                  <TabBarIcon name={config.icon} color={focused ? theme.ink : '#6A6B65'} focused={focused} />
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

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 20 },
  pill: { width: '100%', maxWidth: 390, height: 66, borderRadius: 35, borderWidth: 1, borderColor: '#FFFFFFCC', shadowColor: '#514B40', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 12, overflow: 'hidden' },
  glassBackground: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 35 },
  surfaceTint: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF3B', borderRadius: 35 },
  topHighlight: { position: 'absolute', top: 1, left: 25, right: 25, height: 1, backgroundColor: '#FFFFFFEE' },
  items: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, gap: 2 },
  item: { flex: 1, height: 53, alignItems: 'center', justifyContent: 'center', borderRadius: 27 },
  activeItem: { flex: 1, height: 53, alignItems: 'center', justifyContent: 'center', borderRadius: 27 },
  activeLens: { position: 'absolute', top: 6, left: 7, height: 53, borderRadius: 27, borderWidth: 1, borderColor: '#FFFFFFDF', shadowColor: '#FFFFFF', shadowOpacity: 0.75, shadowRadius: 9, overflow: 'hidden' },
  lensGlass: { flex: 1, borderRadius: 27 },
  lensFill: { flex: 1, backgroundColor: '#FFFFFFA0', borderRadius: 27 },
  icon: { width: 24, height: 24, marginBottom: 1 },
  label: { color: '#737671', fontSize: 10, fontWeight: '600' },
  activeLabel: { color: theme.ink, fontWeight: '800' },
});
