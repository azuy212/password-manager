# Password Manager - Expo + React Native

A secure, zero-knowledge password manager built with Expo, React Native, and Supabase.

## Features

- 🔐 **Zero-Knowledge Architecture**: All data is encrypted client-side before sync
- 🛡️ **Native Crypto**: AES-GCM encryption via native modules (iOS/Android)
- ☁️ **Cloud Sync**: Supabase backend for multi-device synchronization
- 👥 **Secure Sharing**: Share passwords with other users using public-key cryptography
- 🔓 **Auto-Lock**: Automatically locks after configurable inactivity period
- 📱 **Expo Router**: File-based routing with TypeScript support
- 🎨 **Dark Mode**: Supports light and dark themes

## Tech Stack

- **Framework**: Expo SDK 54 + React Native 0.81
- **Routing**: Expo Router (file-based)
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Storage**: 
  - SecureStore (master key & identity)
  - AsyncStorage (vault data)
- **Crypto**: Native module (AES-GCM, PBKDF2, Ed25519)
- **Language**: TypeScript

## Architecture

```
password-manager/
├── app/                      # Expo Router screens
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
├── store/                    # Zustand stores
├── types/                    # TypeScript types
├── services/                 # External services
├── crypto-native/           # Native crypto module
│   ├── ios/                 # iOS (Swift)
│   └── android/             # Android (Kotlin)
└── supabase/                 # Database schema
```

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- Xcode (iOS) or Android Studio (Android)
- Supabase account (for cloud sync)

### Installation

1. **Clone and install dependencies**:
```bash
cd password-manager
npm install
```

2. **Configure environment variables**:
```bash
cp .env.example .env.local
```
Edit `.env.local` and add your Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. **Set up Supabase** (optional for local-only use):
Run the SQL schema from `supabase/schema.sql` in your Supabase SQL editor.

4. **Build native modules**:
```bash
npx expo prebuild
```

### Development

```bash
# Start development server
npx expo start

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

### Building for Production

```bash
# iOS
npx expo run:ios --configuration Release

# Android
npx expo run:android --variant release
```

## Security Model

### Encryption Flow

1. **Master Key Derivation**:
   - User password → PBKDF2-SHA256 (100,000 iterations) → 256-bit key

2. **Data Encryption**:
   - Each vault entry encrypted with AES-256-GCM
   - Unique nonce per encryption operation
   - Authentication tag prevents tampering

3. **Identity & Sharing**:
   - Ed25519 keypair for signing and verification
   - Public keys exchanged for secure sharing
   - Encrypted private keys stored in SecureStore

4. **Storage**:
   - Master key: Never persisted (in-memory only)
   - Identity: SecureStore (iOS Keychain / Android Keystore)
   - Vault data: AsyncStorage (encrypted)
   - Cloud: Supabase (encrypted end-to-end)

### Security Features

- ✅ Auto-lock on background/inactivity
- ✅ Screenshot protection (TODO: implement)
- ✅ No plaintext passwords in memory longer than needed
- ✅ Row Level Security on all database tables
- ✅ Zero-knowledge: server never sees unencrypted data

## Usage

### First Time Setup

1. Open the app
2. Create a strong master password (minimum 8 characters)
3. Your identity and encryption keys are generated
4. **Important**: Your master password cannot be recovered!

### Creating Vaults & Entries

1. Tap **+** to create a new vault
2. Open a vault and tap **+** to add an entry
3. Fill in title, username, password, URL, and notes
4. All data is encrypted automatically

### Sharing Passwords

1. Open an entry
2. Tap **Share**
3. Enter recipient's email
4. The entry is encrypted with their public key

### Multi-Device Sync

1. Sign in with the same Supabase account
2. Sync happens automatically
3. Conflicts resolved with last-write-wins

## Testing

```bash
# Run TypeScript checks
npx tsc --noEmit

# Run linting
npm run lint
```

## Important Notes

⚠️ **Password Recovery**: There is NO password recovery. If you forget your master password, all data is permanently inaccessible.

⚠️ **Native Build**: The crypto module requires a native build. You must run `npx expo prebuild` and use a dev client.

⚠️ **Backup**: Export your data regularly or use cloud sync to prevent data loss.

## Roadmap

- [ ] Biometric unlock (Face ID / Touch ID)
- [ ] Password generator
- [ ] Import/export functionality
- [ ] TOTP/2FA support
- [ ] Breach monitoring
- [ ] Offline-only mode
- [ ] Backup to file/iCloud/Google Drive

## License

MIT

## Contributing

Pull requests welcome! Please ensure all TypeScript checks pass before submitting.
