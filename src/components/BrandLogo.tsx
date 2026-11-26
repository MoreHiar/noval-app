import { Platform } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { logoSvg } from '../branding/logo';

const artwork = logoSvg();

export function BrandLogo({ size = 48 }: { size?: number }) {
  return <SvgXml xml={artwork} width={size} height={size} style={{ borderRadius: size * 0.26, overflow: 'hidden' }}
    accessibilityLabel={Platform.OS === 'web' ? undefined : 'Noval 阅读 Logo'} aria-label={Platform.OS === 'web' ? 'Noval 阅读 Logo' : undefined}
    accessible={Platform.OS === 'web' ? undefined : true} role={Platform.OS === 'web' ? 'img' : undefined} />;
}
