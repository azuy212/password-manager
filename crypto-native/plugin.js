const { createRunOncePlugin } = require('@expo/config-plugins');

const withCryptoNative = (config) => {
  return config;
};

module.exports = createRunOncePlugin(withCryptoNative, 'crypto-native');
