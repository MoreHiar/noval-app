import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export type TabBarIconName = 'search' | 'profile' | 'sources' | 'bookshelf';

// Keep the paths aligned with the standalone SVGs in assets/icons/tabbar.
const paths: Record<TabBarIconName, string[]> = {
  search: [
    'M17.5 10.5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
    'm15.5 15.5 5 5',
  ],
  profile: [
    'M16 7.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    'M4.5 20v-1a6 6 0 0 1 6-6h3a6 6 0 0 1 6 6v1',
  ],
  sources: [
    'M3.5 15.5V5a2 2 0 0 1 2-2H16',
    'M8 6.5h10.5a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z',
    'M13 6.5v7l2.5-1.5 2.5 1.5v-7M9.5 17.5h4',
  ],
  bookshelf: [
    'M4 17.5V5.5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v12M8.5 5.5a1 1 0 0 1 1-1H12a1 1 0 0 1 1 1v12M4 8h4.5M8.5 14H13',
    'm13.5 6.5 3.4-.9a1 1 0 0 1 1.2.7l2.7 10.3M2.5 20.5h19',
  ],
};

type TabBarIconProps = {
  name: TabBarIconName;
  color: string;
  focused?: boolean;
  size?: number;
};

export function TabBarIcon({ name, color, focused = false, size = 24 }: TabBarIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={focused ? 2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={Platform.OS === 'web' ? undefined : false}
      aria-hidden={Platform.OS === 'web' ? true : undefined}
      focusable={false}
    >
      {paths[name].map((d) => <Path key={d} d={d} />)}
    </Svg>
  );
}
