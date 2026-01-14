# Deploy to Netlify

Your expense tracker app is ready to deploy to Netlify!

## Quick Deploy Steps

1. **Push to GitHub/GitLab/Bitbucket**
   - Create a new repository
   - Push your code to the repository

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com) and sign in
   - Click "Add new site" > "Import an existing project"
   - Connect your Git provider and select your repository

3. **Configure Build Settings**
   - Build command: `npm run build` (already configured in netlify.toml)
   - Publish directory: `dist` (already configured in netlify.toml)
   - Click "Deploy site"

4. **Add Environment Variables**
   - In Netlify dashboard, go to Site settings > Environment variables
   - Add these variables:
     - `VITE_SUPABASE_URL` = Your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY` = Your Supabase anonymous key
   - Redeploy your site after adding the variables

## Alternative: Deploy via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

## What's Configured

- ✅ Build command and output directory
- ✅ SPA redirects for React Router
- ✅ Node version (18)
- ✅ Production build optimization

Your app will be live at your Netlify URL after deployment!
