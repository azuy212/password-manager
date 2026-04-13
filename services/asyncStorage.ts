/**
 * Platform-aware AsyncStorage export.
 * - On web: uses the localStorage-based shim
 * - On native: uses @react-native-async-storage/async-storage
 */
import AsyncStorage from './asyncStorage.web';
export default AsyncStorage;
