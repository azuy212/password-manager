# Password Manager - Build & Run Guide

## Quick Start

### Option 1: Using the setup script
```bash
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment (edit .env.local with your Supabase credentials)
cp .env.example .env.local

# 3. Prebuild native projects
npx expo prebuild --clean
```

## Running the App

### Development Mode (Recommended for testing)
```bash
npx expo start
```
Then press:
- `i` for iOS simulator
- `a` for Android emulator
- Scan QR code with Expo Go app on your phone

### Dev Client (Required for native crypto module)

#### iOS
```bash
npx expo run:ios
```

#### Android
```bash
npx expo run:android
```

### Production Build

#### iOS
```bash
# Build for simulator
npx expo run:ios --configuration Release

# Build for device (requires Apple Developer account)
npx expo run:ios --device
```

#### Android
```bash
# Build APK
npx expo run:android --variant release

# Build AAB for Play Store
cd android
./gradlew bundleRelease
```

## Supabase Setup (Required for cloud sync)

1. Create a Supabase account at https://supabase.com
2. Create a new project
3. Go to Project Settings > API
4. Copy the URL and anon key
5. Update `.env.local`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
6. Run the SQL schema in Supabase SQL editor:
   - Open `supabase/schema.sql`
   - Copy and paste into Supabase SQL editor
   - Run the script

## Troubleshooting

### TypeScript Errors
```bash
npx tsc --noEmit
```

### Clean and Rebuild
```bash
# Clear Expo cache
npx expo start --clear

# Clean and prebuild
npx expo prebuild --clean
```

### iOS Issues
```bash
# Clean iOS build
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### Android Issues
```bash
# Clean Android build
cd android
./gradlew clean
cd ..
```

### Module Not Found Errors
```bash
# Rebuild crypto-native module
cd crypto-native
npm run build
cd ..

# Reinstall dependencies
rm -rf node_modules
npm install
```

## Testing on Physical Devices

### iOS
1. Connect your iPhone via USB
2. Trust the computer
3. Run: `npx expo run:ios --device`

### Android
1. Enable USB debugging in Developer Options
2. Connect via USB
3. Run: `npx expo run:android`

## Multi-Device Testing

1. Set up Supabase (see above)
2. Build and install on first device
3. Build and install on second device
4. Sign in with same Supabase account
5. Data will sync automatically

## Important Notes

⚠️ The crypto-native module requires a dev client build - you cannot use Expo Go
⚠️ Always commit changes before running prebuild (it modifies native files)
⚠️ Master password cannot be recovered - warn users during setup
