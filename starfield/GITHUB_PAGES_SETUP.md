# GitHub Pages Deployment Guide

## Quick Deploy (Recommended)

Run the deployment script:

```bash
cd /Users/rachaeljaixen/Documents/penguinpal/starfield
./deploy.sh
```

When prompted for credentials:
- **Username:** Your GitHub username
- **Password:** Your GitHub Personal Access Token (see below)

## Get GitHub Personal Access Token

1. Go to https://github.com/settings/tokens/new
2. Give it a name: "Penguinpal Starfield Deploy"
3. Set expiration (30 days recommended)
4. Check the **`repo`** scope (full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)
7. Use this as your password when pushing

## Enable GitHub Pages

After pushing your code:

1. Go to your repository settings:
   👉 https://github.com/AIML-1870-2026/penguinpal/settings/pages

2. Under "Build and deployment":
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`

3. Click **Save**

4. Wait 1-2 minutes for deployment

5. Your site will be live at:
   🌐 **https://AIML-1870-2026.github.io/penguinpal/starfield/**

## Alternative: Manual Push

If you prefer to push manually:

```bash
cd /Users/rachaeljaixen/Documents/penguinpal/starfield
git add .
git commit -m "Deploy to GitHub Pages"
git push -u origin main
```

## Verify Deployment

Once enabled, check deployment status:
- Go to the "Actions" tab in your repository
- You should see a "pages build and deployment" workflow
- Green checkmark = successfully deployed!

## Troubleshooting

### Authentication Failed?
- Make sure you're using a Personal Access Token, not your GitHub password
- Token must have `repo` scope enabled
- Try regenerating a new token

### Site Not Loading?
- Wait 2-3 minutes after enabling GitHub Pages
- Clear your browser cache
- Check the Actions tab for deployment errors

### Custom Domain (Optional)
If you want to use a custom domain:
1. Add a `CNAME` file with your domain name
2. Configure DNS settings with your domain provider
3. Enable HTTPS in GitHub Pages settings

## Update Your Site

To deploy updates:

```bash
cd /Users/rachaeljaixen/Documents/penguinpal/starfield
git add .
git commit -m "Update starfield animation"
git push
```

GitHub Pages will automatically rebuild and deploy!
