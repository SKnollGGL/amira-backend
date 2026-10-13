# GitHub Repository Setup - ARIS Backend

## Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Create repository with these settings:
   - **Repository name**: `amira-backend`
   - **Description**: ARIS Platform SaaS - Multi-tenant Backend API
   - **Public/Private**: Private (recommended)
   - **Add .gitignore**: Node (already included in project)
   - **Add license**: MIT

3. Click "Create repository"

## Step 2: Initialize Local Git Repository

```bash
cd C:\Users\catab\Desktop\SISTEM_AMIRA\ARIS_Platform_SaaS\backend

# Initialize git if not already done
git init

# Add all files
git add .

# Initial commit
git commit -m "Days 1-2: TypeScript conversion, database schema, error handling

- Convert Express.js to TypeScript with full type safety
- Complete database schema with 12 tables (PostgreSQL/Supabase)
- Comprehensive error handling framework with logging
- Configuration management and environment variables
- Security middleware: CORS, Helmet, rate limiting
- TypeScript strict mode configuration
- Jest testing setup
- ESLint and Prettier configuration
- Production-ready structure"
```

## Step 3: Add Remote and Push

```bash
# Add remote (replace YOUR_USERNAME and YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/amira-backend.git

# Verify remote
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 4: Verify on GitHub

Visit: `https://github.com/YOUR_USERNAME/amira-backend`

Should show:
- ✅ All source files in `src/` directory
- ✅ Configuration files (.env.example, tsconfig.json, etc.)
- ✅ Database schema (src/database/schema.sql)
- ✅ package.json with TypeScript dependencies
- ✅ README with project documentation
- ✅ Initial commit message

## Step 5: GitHub Branches Setup (Optional)

Create branch structure for ongoing development:

```bash
# Create development branch
git checkout -b develop
git push -u origin develop

# Create feature branches for each phase
git checkout -b feature/days-3-4-oauth-stripe
git checkout -b feature/days-5-6-recording-results
git checkout -b feature/days-7-8-monitoring-security
git checkout -b feature/days-9-10-production
```

## Step 6: GitHub Actions (Optional - Days 7-8)

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - run: npm ci
    - run: npm run lint
    - run: npm run type-check
    - run: npm run test:coverage
    - run: npm run build
```

## Step 7: Add Branch Protection (Optional)

In GitHub repo settings:
1. Go to Settings → Branches
2. Add rule for `main` branch:
   - Require pull request reviews
   - Require status checks to pass
   - Require branches to be up to date

## Commit Strategy

For remaining days, follow this pattern:

```bash
# Day 3-4 features
git checkout -b feature/days-3-4-oauth-stripe develop
# ... make changes ...
git commit -m "Day 3-4: OAuth + Stripe implementation

- POST /api/oauth/callback for Google, HubSpot, Twilio
- POST /api/payment/create-subscription 
- OAuth token encryption and storage
- Stripe webhook verification
- Comprehensive testing"
git push -u origin feature/days-3-4-oauth-stripe

# Create pull request on GitHub
# Merge to develop after code review
```

## Useful Git Commands

```bash
# Check status
git status

# View commit history
git log --oneline

# See what changed
git diff

# Amend last commit
git commit --amend

# Push to feature branch
git push origin feature-name

# Pull latest changes
git pull origin main

# Check which branch you're on
git branch -a
```

## README Badge (Optional)

Add to README.md:

```markdown
[![Build Status](https://github.com/YOUR_USERNAME/amira-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/amira-backend/actions)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
```

## Issues and PRs

### Create Issue
1. Click "Issues" tab
2. Click "New Issue"
3. Title: `[Days X-Y] Feature/Bug description`
4. Template: Include acceptance criteria

### Create Pull Request
1. Push feature branch
2. Click "Create pull request"
3. Template: Link to issues, describe changes, checklist

## CI/CD Roadmap (Days 9-10)

Plan these integrations:
- ✅ GitHub Actions for testing
- ✅ Automated deployment to Heroku
- ✅ Slack notifications
- ✅ Codecov coverage reports

## Support

For issues:
1. Check existing issues on GitHub
2. Create new issue with template
3. Tag as `bug`, `enhancement`, `documentation`, etc.
4. Assign to Day phase (e.g., `days-3-4`)

---

**Next Step**: After completing Step 3, you'll have the complete Days 1-2 foundation pushed to GitHub!
