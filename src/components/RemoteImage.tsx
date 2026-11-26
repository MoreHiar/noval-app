import { Image } from 'expo-image';
import type { RemoteImageProps } from './RemoteImage.types';

export function RemoteImage({ uri, style, contentFit = 'cover', recyclingKey, accessibilityLabel, onLoad, onError }: RemoteImageProps) {
  return <Image source={{ uri }} style={style} contentFit={contentFit} recyclingKey={recyclingKey} accessibilityLabel={accessibilityLabel}
    onLoad={event => onLoad?.(event.source.width, event.source.height)} onError={onError} />;
}
