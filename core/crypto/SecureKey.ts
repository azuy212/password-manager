export class SecureKey {
  private _bytes: Uint8Array

  constructor(bytes: number[]) {
    this._bytes = new Uint8Array(bytes)
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this._bytes)
  }

  toArray(): number[] {
    return Array.from(this._bytes)
  }

  destroy(): void {
    this._bytes.fill(0)
  }
}
