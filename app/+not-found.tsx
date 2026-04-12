import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export default function NotFoundScreen() {
  const colors = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>This screen doesn't exist.</Text>
        <Link href="/" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={[styles.linkText, { color: colors.accent }]}>Go to home screen!</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
