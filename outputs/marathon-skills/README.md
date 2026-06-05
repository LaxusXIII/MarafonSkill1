# Marathon Skills

Static Marathon Skills site with Supabase database and Google authentication.

## Deploy to Vercel

Use `outputs/marathon-skills` as the project root.

Build settings:

- Framework Preset: Other
- Build Command: leave empty
- Output Directory: leave empty or `.`
- Install Command: leave empty

After deployment, add the Vercel URL to Supabase:

- Authentication > URL Configuration > Site URL
- Authentication > URL Configuration > Redirect URLs
- Google Cloud OAuth Authorized redirect URIs, if you configured Google manually
