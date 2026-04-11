import * as React from 'react';

import { CryptoNativeViewProps } from './CryptoNative.types';

export default function CryptoNativeView(props: CryptoNativeViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url || ''}
        onLoad={() => props.onLoad?.({ nativeEvent: { url: props.url || '' } })}
      />
    </div>
  );
}
