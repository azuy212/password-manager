import { requireNativeView } from 'expo';
import * as React from 'react';

import { CryptoNativeViewProps } from './CryptoNative.types';

const NativeView: React.ComponentType<CryptoNativeViewProps> =
  requireNativeView('CryptoNative');

export default function CryptoNativeView(props: CryptoNativeViewProps) {
  return <NativeView {...props} />;
}
