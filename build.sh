#!/bin/bash
# build.sh - Build script for Render deployment
# Builds frontend and copies to backend for serving

set -e

echo "======================================"
echo "Building Jireh Sports for Production"
echo "======================================"

# Build Frontend
echo "📦 Building frontend..."
cd ../jireh-app
npm install
npm run build
cd ../jireh-backend/jireh-backend

# Copy frontend build to backend public folder
echo "📁 Copying frontend to backend..."
mkdir -p ./public
rm -rf ./public/*
cp -r ../../../jireh-app/dist/* ./public/

echo "✅ Build complete!"
echo "Frontend: public/ folder ready"
echo "Backend: Ready to start"
