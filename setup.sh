#!/bin/bash

# Password Manager - Quick Start Script

echo "🔐 Password Manager - Setup & Build"
echo "===================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  Creating .env.local from example..."
    cp .env.example .env.local
    echo "📝 Please edit .env.local with your Supabase credentials"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run prebuild
echo "🔨 Running prebuild..."
npx expo prebuild --clean

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the app:"
echo "  iOS:     npx expo run:ios"
echo "  Android: npx expo run:android"
echo "  Dev:     npx expo start"
echo ""
