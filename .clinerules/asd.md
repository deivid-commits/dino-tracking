vamos a poner la verison un numero de version si estamos haceindo deployment para asegurarnos de estar chequeando la ultima version

DESPLIEGUE FILEBASE:

para hacer deploy a vercel necesitas .
1. .vercelignore
2. package.json con build script y vercel config

scripts para deploy:
"build": "vite build",
"preview": "vite preview"
"vercel": "vercel",
"vercel-deploy": "vercel --prod"

para datos sensitivos usa vercel secrets:
vercel secrets add SUPABASE_URL
vercel secrets add SUPABASE_ANON_KEY

deploy workflow:
1. commit changes
2. vercel --prod
3. check vercel dashboard

VERSION CONTROL:
- increment version number each deploy
- log changes in .clinerules/version-log.md
- automatic tagging with git tag v1.0.x
