import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SharedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shared with Me</Text>
      <Text style={styles.subtitle}>
        Entries shared with you will appear here
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
