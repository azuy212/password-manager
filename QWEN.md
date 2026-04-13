# Password Manager - Project Context

## Project Overview

A **zero-knowledge password manager** built with **Expo SDK 54**, **React Native 0.81**, and **Supabase**. All data is encrypted client-side before synchronization, ensuring the server never sees unencrypted data. The app features AES-GCM encryption via native modules, cloud sync through Supabase, secure password sharing via public-key cryptography, and auto-lock functionality.

### Key Features
- Zero-knowledge architecture with client-side encryption
- Native crypto module (AES-GCM, PBKDF2, Ed25519)
- Supabase backend with Row Level Security (RLS)
- Secure password sharing between users
- Auto-lock after inactivity
- Dark mode support
- File-based routing with Expo Router

### Tech Stack
- **Framework**: Expo SDK 54 + React Native 0.81
- **Routing**: Expo Router (file-based)
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL with RLS)
- **Storage**: SecureStore (master key & identity), AsyncStorage (vault data)
- **Crypto**: Native module (`crypto-native`) for AES-GCM, PBKDF2, Ed25519
- **Language**: TypeScript (strict mode)

## Project Structure

```
password-manager/
├── app/                      # Expo Router screens
│   ├── _layout.tsx          # Root layout with navigation stack
│   ├── index.tsx            # Unlock screen
│   ├── setup.tsx            # First-time setup
│   ├── (tabs)/              # Main app tabs
│   ├── vault.tsx            # Vault entries list
│   └── entry.tsx            # Entry editor
├── core/                     # Core business logic
│   ├── crypto/              # Crypto wrappers
│   ├── auth/                # Identity & auth
│   ├── vault/               # Vault management
│   ├── sync/                # Cloud sync
│   ├── sharing/             # Password sharing
│   └── security/            # Security features
├── store/                    # Zustand stores (useAppStore.ts)
├── types/                    # TypeScript types (vault.ts, identity.ts)
├── services/                 # External services
├── crypto-native/           # Native crypto module (iOS Swift / Android Kotlin)
├── supabase/                 # Database migrations & config
│   ├── config.toml          # Supabase CLI configuration
│   └── migrations/          # Ordered migration files
├── components/               # Reusable UI components
├── constants/                # App constants
└── utils/                    # Utility functions
```

## Building and Running

### Prerequisites
- Node.js 18+
- Xcode (iOS) or Android Studio (Android)
- Supabase account (optional, for cloud sync)

### Setup Commands

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# Prebuild native projects (required for crypto-native module)
npx expo prebuild --clean
```

### Development

```bash
# Start development server
npm start          # or: npx expo start

# Run on iOS simulator
npm run ios        # or: npx expo run:ios

# Run on Android emulator
npm run android    # or: npx expo run:android

# Run on web
npm run web        # or: npx expo start --web
```

**Note**: The `crypto-native` module requires a **dev client build** — you cannot use Expo Go. Use `npx expo run:ios` or `npx expo run:android` instead.

### Quality Checks

```bash
# TypeScript type checking
npx tsc --noEmit
```

### Troubleshooting

```bash
# Clear Expo cache
npx expo start --clear

# Clean and rebuild native projects
npx expo prebuild --clean

# iOS: Clean pods
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..

# Android: Clean build
cd android && ./gradlew clean && cd ..
```

## Architecture & Patterns

### State Management
- **Zustand** is used for global state management (`store/useAppStore.ts`)
- Single store pattern with explicit actions
- Master keys are destroyed on state reset via `key.destroy()`

### Encryption Flow
1. **Master Key Derivation**: User password → PBKDF2-SHA256 (100,000 iterations) → 256-bit key
2. **Data Encryption**: Each vault entry encrypted with AES-256-GCM, unique nonce per operation
3. **Identity & Sharing**: Ed25519 keypair for signing; public keys exchanged for secure sharing
4. **Storage**: Master key in-memory only; identity in SecureStore; vault data in AsyncStorage (encrypted)

### TypeScript Conventions
- Strict mode enabled (`"strict": true`)
- Path aliases: `@/*` maps to project root
- Interfaces for domain types (`VaultEntry`, `Vault`, `Identity`)
- Type suffix pattern: `*Input` for create/update DTOs

### Navigation
- Expo Router with Stack navigation
- Modal presentation for entry editing (`options={{ presentation: 'modal' }}`)
- Theme provider with dark/light mode support

### Database
- Supabase PostgreSQL with Row Level Security (RLS) on all tables
- Tables: `users`, `vaults`, `vault_entries`, `shared_entries`, `audit_log`
- Last-write-wins conflict resolution for sync
- Salt column access restricted to `get_my_salt()` security definer function
- Migrations live in `supabase/migrations/` — create with `supabase migration new <name>`

## Important Security Notes

- **No password recovery**: Master passwords cannot be recovered
- **Zero-knowledge**: Server never sees unencrypted data
- **Auto-lock**: App locks on background/inactivity
- **RLS policies**: All database tables have row-level security
- **Key management**: Master keys destroyed properly via `destroy()` method

## Environment Variables

Defined in `.env.local` (see `.env.example`):
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Development Conventions

- TypeScript for all code
- File-based routing via Expo Router (`app/` directory)
- Business logic in `core/` organized by domain
- Zustand for global state (single store pattern)
- Native modules require `npx expo prebuild`
- Strict TypeScript configuration
