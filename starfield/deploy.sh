#!/bin/bash

# Penguinpal Starfield - GitHub Pages Deployment Script

echo "🚀 Deploying Penguinpal Starfield to GitHub Pages..."
echo ""

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found. Make sure you're in the penguinpal/starfield directory."
    exit 1
fi

# Add all changes
echo "📦 Adding changes..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Deploy to GitHub Pages" || echo "No changes to commit"

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
echo ""
echo "You'll be prompted for authentication:"
echo "  Username: your GitHub username"
echo "  Password: <paste your GitHub Personal Access Token>"
echo ""

git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "📋 Next steps to enable GitHub Pages:"
    echo ""
    echo "1. Go to: https://github.com/AIML-1870-2026/penguinpal/settings/pages"
    echo "2. Under 'Source', select 'Deploy from a branch'"
    echo "3. Select 'main' branch and '/ (root)' folder"
    echo "4. Click 'Save'"
    echo ""
    echo "Your site will be live at:"
    echo "🌐 https://AIML-1870-2026.github.io/penguinpal/starfield/"
    echo ""
    echo "It may take a few minutes for the site to go live."
else
    echo ""
    echo "❌ Push failed. Please check your credentials and try again."
    echo ""
    echo "Need a Personal Access Token?"
    echo "Go to: https://github.com/settings/tokens/new"
    echo "Select 'repo' scope and generate the token."
fi
