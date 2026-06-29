/**
 * Platform-aware AsyncStorage export.
 * - On web: uses AES-GCM encrypted localStorage
 * - On native: uses @react-native-async-storage/async-storage
 */
import AsyncStorage from './secureAsyncStorage.web';
export default AsyncStorage;
