import type { ImageStyle, StyleProp } from 'react-native';

export type RemoteImageProps = {
  uri: string;
  style: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  recyclingKey?: string;
  accessibilityLabel: string;
  onLoad?(width: number, height: number): void;
  onError?(): void;
};
