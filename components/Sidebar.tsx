import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/utils/themedStyles';

const SIDEBAR_WIDTH = 240;

type NavItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  danger?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { icon: 'lock-closed', label: 'Vaults', route: '/(tabs)' },
  { icon: 'people', label: 'Shared', route: '/(tabs)/shared' },
  { icon: 'settings', label: 'Settings', route: '/(tabs)/settings' },
];

type SidebarProps = {
  onLock?: () => void;
};

export function Sidebar({ onLock }: SidebarProps) {
  const colors = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const styles = createStyles(colors);

  const activeRoute = getActiveRoute(pathname);

  return (
    <View style={styles.sidebar}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoIcon}>
          <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          VaultGuard
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Nav Items */}
      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.route;
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => router.push(item.route as any)}
              {...(Platform.OS === 'web'
                ? {
                    onMouseEnter: (e: any) =>
                      !isActive && (e.currentTarget.style.background = colors.primaryMuted),
                    onMouseLeave: (e: any) =>
                      !isActive && (e.currentTarget.style.background = 'transparent'),
                  }
                : {})}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={isActive ? colors.accent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { color: isActive ? colors.accent : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Lock button */}
      <TouchableOpacity
        style={styles.lockButton}
        onPress={onLock}
        {...(Platform.OS === 'web'
          ? {
              onMouseEnter: (e: any) =>
                (e.currentTarget.style.background = colors.dangerLight),
              onMouseLeave: (e: any) =>
                (e.currentTarget.style.background = 'transparent'),
            }
          : {})}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.lockLabel, { color: colors.danger }]} numberOfLines={1}>
          Lock Vault
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function getActiveRoute(pathname: string): string {
  if (pathname.includes('/shared')) return '/(tabs)/shared';
  if (pathname.includes('/settings')) return '/(tabs)/settings';
  return '/(tabs)';
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    sidebar: {
      width: SIDEBAR_WIDTH,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      flexDirection: 'column',
      ...Platform.select({
        web: {
          minHeight: '100vh',
          height: '100%',
          position: 'sticky',
          top: 0,
        } as any,
        default: {},
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    logoIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      ...typography.h4,
      color: colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: spacing.md,
    },
    navList: {
      padding: spacing.sm,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.sm,
      marginBottom: 2,
      gap: spacing.sm,
    },
    navItemActive: {
      backgroundColor: colors.primaryMuted,
    },
    navLabel: {
      ...typography.bodyMedium,
      fontSize: 14,
    },
    spacer: {
      flex: 1,
    },
    lockButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.sm,
      marginBottom: spacing.md,
      marginHorizontal: spacing.sm,
      gap: spacing.sm,
    },
    lockLabel: {
      ...typography.bodyMedium,
      fontSize: 14,
    },
  });
}
