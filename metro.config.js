const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Alias @react-native-async-storage/async-storage to our web-compatible shim
// This lets the native module work on web via localStorage.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '@react-native-async-storage/async-storage' &&
    (platform === 'web' || platform === '')
  ) {
    return context.resolveRequest(
      context,
      path.join(__dirname, 'services/asyncStorage'),
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
