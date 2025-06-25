#!/bin/bash

echo "=== Checking for incorrect import paths ==="

echo "Searching for @/frontend/ imports..."
find frontend -name "*.tsx" -o -name "*.ts" | xargs grep -l "@/frontend/" 2>/dev/null || echo "No @/frontend/ imports found ✓"

echo -e "\nSearching for @/frontend/ in all frontend files..."
find frontend -name "*.tsx" -o -name "*.ts" | xargs grep -n "@/frontend/" 2>/dev/null || echo "All imports are correct ✓"

echo -e "\nListing all @ imports to verify they're correct..."
find frontend -name "*.tsx" -o -name "*.ts" | xargs grep -n "from ['\"]@/" 2>/dev/null | head -20
