# Finance Tracker Deployment Runbook

## Target Architecture
- Backend hosting: Railway
- Frontend hosting: Vercel
- Database: MongoDB Atlas
- CI trigger: Push/PR on main branch
- CD trigger: main branch auto-deploy (Railway + Vercel)

## What Is Already Implemented In Repo
- Backend CI workflow: .github/workflows/backend-ci.yml
- Frontend CI workflow: .github/workflows/frontend-ci.yml
- Backend health endpoint: GET /api/health
- Backend CORS now supports FRONTEND_URL / CORS_ORIGINS env vars
- Frontend API base URL now supports REACT_APP_API_BASE_URL with localhost fallback
- Backend environment template: BACKEND/.env.example
- Frontend environment template: frontend/.env.example

## Step 1: Git Branch Strategy
1. Keep main as production branch.
2. Keep development for feature testing.
3. Open pull requests from development to main.
4. Enable required status checks for CI workflows before merge.

## Step 2: Backend Deploy on Railway
1. Create Railway project from GitHub repository.
2. Select BACKEND as the service root directory.
3. Build command: npm install
4. Start command: npm start
5. Add environment variables:
   - MONGO_URI
   - JWT_SECRET
   - FINNHUB_API_KEY
   - EMAIL_HOST
   - EMAIL_PORT
   - EMAIL_USER
   - EMAIL_PASSWORD
   - NODE_ENV=production
   - FRONTEND_URL=<your vercel domain>
   - Optional: CORS_ORIGINS=<comma separated origins>
6. Deploy and copy Railway public URL.
7. Verify backend health: <railway-url>/api/health

## Step 3: Frontend Deploy on Vercel
1. Create Vercel project from same GitHub repository.
2. Set root directory to frontend.
3. Build command: npm run build
4. Output directory: build
5. Add env var:
   - REACT_APP_API_BASE_URL=<railway-url>/api
6. Redeploy.

## Step 4: Production Validation
1. Open deployed frontend URL.
2. Test auth flow:
   - Register/Login
   - Token-protected routes
3. Test reports and AI endpoints.
4. Confirm no CORS errors in browser console.
5. Confirm Railway logs show clean startup and DB connection.

## Step 5: CI/CD Validation
1. Push any small change to development.
2. Open PR to main and confirm both workflows pass.
3. Merge to main and confirm:
   - Railway auto-deploy starts
   - Vercel auto-deploy starts
4. Validate production app after deploy completion.

## Step 6: Rollback Plan
1. If frontend issue: redeploy previous successful Vercel deployment.
2. If backend issue: rollback to previous successful Railway deployment.
3. Keep release notes/changelog entry for each production merge.

## Supervisor Demo Flow
1. Show GitHub Actions passing for both backend and frontend.
2. Show Railway/Vercel auto-deploy after merge to main.
3. Open deployed app.
4. Login and open Reports.
5. Show AI personalized section and status.
