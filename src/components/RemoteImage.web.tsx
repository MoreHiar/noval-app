import { Image } from 'expo-image';
import type { CSSProperties } from 'react';
import { StyleSheet } from 'react-native';
import type { RemoteImageProps } from './RemoteImage.types';

export function RemoteImage({ uri, style, contentFit = 'cover', recyclingKey, accessibilityLabel, onLoad, onError }: RemoteImageProps) {
  if (uri.startsWith('https://img.guazicdn.com/')) {
    return <img src={uri} alt={accessibilityLabel} referrerPolicy="no-referrer" loading="lazy"
      style={{ ...(StyleSheet.flatten(style) as CSSProperties), objectFit: contentFit }}
      onLoad={event => onLoad?.(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} onError={onError} />;
  }
  return <Image source={{ uri }} style={style} contentFit={contentFit} recyclingKey={recyclingKey} accessibilityLabel={accessibilityLabel}
    onLoad={event => onLoad?.(event.source.width, event.source.height)} onError={onError} />;
}
