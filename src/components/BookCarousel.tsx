import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Book } from '../domain/books';
import { theme } from './theme';

const INPUT = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const ROTATION = ['63deg', '59deg', '53deg', '43deg', '-8deg', '-43deg', '-53deg', '-59deg', '-63deg'];
const SCALE = [0.62, 0.68, 0.75, 0.86, 1.15, 0.86, 0.75, 0.68, 0.62];
const LIFT = [29, 26, 22, 16, -14, 16, 22, 26, 29];

export function BookCarousel({ books, selectedIndex, onSelect }: {
  books: Book[];
  selectedIndex: number;
  onSelect(index: number): void;
}) {
  const [progress] = useState(() => new Animated.Value(selectedIndex));
  const [width, setWidth] = useState(340);

  useEffect(() => {
    Animated.spring(progress, {
      toValue: selectedIndex,
      friction: 8,
      tension: 75,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [progress, selectedIndex]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -38) onSelect(Math.min(selectedIndex + 1, books.length - 1));
      if (gesture.dx > 38) onSelect(Math.max(selectedIndex - 1, 0));
    },
  }), [books.length, onSelect, selectedIndex]);

  const spread = Math.min(width * 0.39, 156);
  const translate = [-spread * 1.42, -spread * 1.27, -spread * 1.05, -spread * 0.63, 0,
    spread * 0.63, spread * 1.05, spread * 1.27, spread * 1.42];

  return (
    <View
      style={styles.stage}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityLabel="书架，左右滑动切换书籍"
      {...panResponder.panHandlers}
    >
      <View style={styles.lightBeam} />
      <View style={styles.floorShadow} />
      {books.map((book, index) => {
        const delta = Animated.subtract(index, progress);
        const openBook = () => router.push({ pathname: '/book/[sourceId]/[bookId]', params: { sourceId: book.sourceId, bookId: book.id } });
        return (
          <Animated.View
            key={`${book.sourceId}/${book.id}`}
            style={[
              styles.bookPosition,
              {
                left: width / 2 - 54,
                zIndex: books.length - Math.abs(index - selectedIndex),
                opacity: delta.interpolate({ inputRange: INPUT, outputRange: [0.35, 0.55, 0.7, 0.95, 1, 0.95, 0.7, 0.55, 0.35], extrapolate: 'clamp' }),
                transform: [
                  { perspective: 850 },
                  { translateX: delta.interpolate({ inputRange: INPUT, outputRange: translate, extrapolate: 'clamp' }) },
                  { translateY: delta.interpolate({ inputRange: INPUT, outputRange: LIFT, extrapolate: 'clamp' }) },
                  { rotateY: delta.interpolate({ inputRange: INPUT, outputRange: ROTATION, extrapolate: 'clamp' }) },
                  { scale: delta.interpolate({ inputRange: INPUT, outputRange: SCALE, extrapolate: 'clamp' }) },
                ],
              },
            ]}
          >
            <Pressable
              style={styles.bookTouch}
              onPress={() => index === selectedIndex ? openBook() : onSelect(index)}
              accessibilityRole="button"
              accessibilityLabel={`${book.title}，${index === selectedIndex ? '查看详情' : '选中书籍'}`}
            >
              <View style={[styles.spine, { backgroundColor: book.accent }]}>
                <View style={styles.spineRule} />
                <View style={styles.spineRule} />
              </View>
              <View style={styles.pages} />
              <View style={styles.cover}>
                <View style={styles.coverTop}>
                  <Text style={styles.coverSeries}>NOVAL  /  BOOKS</Text>
                  <View style={[styles.artFrame, { borderColor: book.accent }]}>
                    <View style={[styles.artSun, { backgroundColor: book.accent }]} />
                    <View style={[styles.artHill, { backgroundColor: book.accent }]} />
                    <View style={styles.artLine} />
                  </View>
                </View>
                <View>
                  <Text style={styles.coverTitle} numberOfLines={2}>{book.title}</Text>
                  <View style={styles.coverRule} />
                  <Text style={styles.coverAuthor} numberOfLines={1}>{book.author}</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
      <View style={styles.stageBottomLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 354, width: '100%', justifyContent: 'center', overflow: 'hidden' },
  lightBeam: { position: 'absolute', width: '42%', height: 290, left: '30%', top: 9, backgroundColor: '#FFFDF8', opacity: 0.6, transform: [{ skewX: '-16deg' }] },
  floorShadow: { position: 'absolute', width: '75%', height: 23, left: '12.5%', bottom: 52, borderRadius: 100, backgroundColor: '#8D867733', transform: [{ scaleY: 0.7 }] },
  stageBottomLine: { position: 'absolute', bottom: 49, width: '100%', height: 1, backgroundColor: '#D9D6CE66' },
  bookPosition: { position: 'absolute', top: 74, width: 108, height: 212 },
  bookTouch: { width: 108, height: 212, flexDirection: 'row', shadowColor: '#444038', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 6, height: 12 }, elevation: 9 },
  spine: { width: 10, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, paddingHorizontal: 3, justifyContent: 'space-between', paddingVertical: 13 },
  spineRule: { height: 1, backgroundColor: '#FFFFFFAA' },
  pages: { position: 'absolute', right: -4, top: 5, width: 6, height: 202, backgroundColor: '#E2DFD6', borderRightWidth: 1, borderRightColor: '#A9A79F' },
  cover: { flex: 1, backgroundColor: '#FBFAF5', borderTopRightRadius: 2, borderBottomRightRadius: 2, borderWidth: 1, borderColor: '#E4E1D8', paddingHorizontal: 9, paddingTop: 11, paddingBottom: 12, justifyContent: 'space-between', overflow: 'hidden' },
  coverTop: { flex: 1 },
  coverSeries: { color: '#817F79', fontSize: 5, letterSpacing: 0.7, marginBottom: 9 },
  artFrame: { height: 91, borderWidth: 1, overflow: 'hidden', backgroundColor: '#F2F0E9' },
  artSun: { width: 26, height: 26, borderRadius: 13, opacity: 0.62, position: 'absolute', top: 13, right: 13 },
  artHill: { width: 108, height: 64, opacity: 0.8, position: 'absolute', bottom: -27, left: -12, transform: [{ rotateZ: '-25deg' }] },
  artLine: { width: 96, height: 1, backgroundColor: '#FFFFFF99', position: 'absolute', bottom: 25, left: 4, transform: [{ rotateZ: '-24deg' }] },
  coverTitle: { color: theme.ink, fontSize: 13, fontWeight: '800', lineHeight: 18, minHeight: 18 },
  coverRule: { width: 17, height: 1, backgroundColor: '#95938C', marginVertical: 5 },
  coverAuthor: { color: '#7D7B75', fontSize: 7 },
});
