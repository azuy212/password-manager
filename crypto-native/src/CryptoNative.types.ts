export type Salt = number[];
export type KeyBytes = number[];
export type DataBytes = number[];

export type EncryptionResult = {
  ciphertext: number[];
  nonce: number[];
  tag: number[];
};

export type KeyPair = {
  privateKey: number[];
  publicKey: number[];
};

export type CryptoNativeModuleEvents = {};

export type OnLoadEventPayload = {
  url: string;
};

export type CryptoNativeViewProps = {
  url?: string;
  onLoad?: (event: { nativeEvent: OnLoadEventPayload }) => void;
};
