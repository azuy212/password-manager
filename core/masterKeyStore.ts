import { SecureKey } from './crypto';

let _masterKey: SecureKey | null = null;

export function getMasterKey(): SecureKey | null {
  return _masterKey;
}

export function setMasterKey(key: SecureKey | null): void {
  if (_masterKey) _masterKey.destroy();
  _masterKey = key;
}

export function destroyMasterKey(): void {
  if (_masterKey) _masterKey.destroy();
  _masterKey = null;
}
