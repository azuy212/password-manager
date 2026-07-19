import * as Clipboard from 'expo-clipboard';
import type { ClipboardProvider } from './interfaces';

export const clipboardProvider: ClipboardProvider = {
  async setString(text) {
    await Clipboard.setStringAsync(text);
  },
};
