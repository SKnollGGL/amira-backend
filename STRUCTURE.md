# Backend Project Structure

```
backend/
│
├── 📂 src/                         # TypeScript source code
│   │
│   ├── 📄 index.ts                # Server entry point (45 lines)
│   │   ├─ Starts Express server on port 3000
│   │   ├─ Graceful shutdown handling
│   │   └─ Process error handlers
│   │
│   ├── 📄 app.ts                  # Express application (165 lines)
│   │   ├─ Middleware stack
│   │   ├─ Security (Helmet, CORS)
│   │   ├─ Logging (Morgan)
│   │   ├─ Rate limiting
│   │   ├─ Health/version endpoints
│   │   └─ Error handlers
│   │
│   ├── 📂 config/
│   │   └── 📄 index.ts            # Configuration management (130 lines)
│   │       ├─ Environment variables
│   │       ├─ Service credentials
│   │       ├─ Validation on startup
│   │       └─ Helper functions
│   │
│   ├── 📂 types/
│   │   └── 📄 index.ts            # TypeScript type definitions (180 lines)
│   │       ├─ Firm, Customer types
│   │       ├─ Bot, Automation types
│   │       ├─ OAuth, Payment types
│   │       ├─ Call, Recording types
│   │       ├─ Execution, Support types
│   │       └─ API response types
│   │
│   ├── 📂 utils/
│   │   └── 📄 errors.ts           # Error handling framework (360 lines)
│   │       ├─ AppError class
│   │       ├─ ErrorFactory
│   │       ├─ ErrorLogger
│   │       ├─ Error middleware
│   │       ├─ Async wrapper
│   │       └─ Validators
│   │
│   ├── 📂 database/
│   │   └── 📄 schema.sql          # Database schema (380 lines)
│   │       ├─ 12 tables
│   │       ├─ Indexes
│   │       ├─ Constraints
│   │       ├─ Triggers
│   │       └─ RLS policies
│   │
│   ├── 📂 routes/                 # (Days 3-10) Route handlers
│   │   ├── 📄 auth.ts             # (Days 3-4) Authentication routes
│   │   ├── 📄 oauth.ts            # (Days 3-4) OAuth routes
│   │   ├── 📄 payment.ts          # (Days 3-4) Stripe routes
│   │   ├── 📄 automation.ts        # (Days 5-6) Automation routes
│   │   ├── 📄 call.ts             # (Days 5-6) Call recording routes
│   │   └── 📄 customer.ts         # (Days 5-6) Customer routes
│   │
│   ├── 📂 services/               # (Days 3-10) Business logic
│   │   ├── 📄 stripe.service.ts   # (Days 3-4) Stripe integration
│   │   ├── 📄 oauth.service.ts    # (Days 3-4) OAuth handling
│   │   ├── 📄 n8n.service.ts      # (Days 5-6) n8n deployment
│   │   ├── 📄 twilio.service.ts   # (Days 5-6) Twilio calls
│   │   └── 📄 database.service.ts # Database queries
│   │
│   ├── 📂 middleware/             # (Days 5-8) Custom middleware
│   │   ├── 📄 auth.ts             # (Days 5-7) Authentication
│   │   ├── 📄 validation.ts       # (Days 5-7) Request validation
│   │   ├── 📄 logging.ts          # (Days 7-8) Performance logging
│   │   └── 📄 encryption.ts       # (Days 7-8) Data encryption
│   │
│   └── 📂 __tests__/              # (Days 7-8) Unit tests
│       ├── 📄 setup.ts            # Test configuration
│       ├── 📄 errors.spec.ts      # Error framework tests
│       ├── 📄 oauth.spec.ts       # OAuth tests
│       ├── 📄 stripe.spec.ts      # Stripe tests
│       └── 📄 integration.spec.ts # Integration tests
│
├── 📂 dist/                        # Compiled JavaScript (generated)
│   └── (Contains compiled .js files after npm run build)
│
├── 📂 node_modules/               # Dependencies (git ignored)
│
├── 🔧 Configuration Files
│   ├── 📄 tsconfig.json           # TypeScript configuration
│   ├── 📄 jest.config.js          # Testing framework
│   ├── 📄 .eslintrc.json          # Code quality rules
│   ├── 📄 .prettierrc.json        # Code formatting
│   └── 📄 package.json            # Dependencies & scripts
│
├── 📋 Environment
│   ├── 📄 .env.example            # Environment template (edit and rename to .env)
│   └── 📄 .env                    # Local config (NEVER commit)
│
├── 📚 Documentation
│   ├── 📄 README.md               # Project overview (350 lines)
│   ├── 📄 GITHUB_SETUP.md         # GitHub repository guide
│   ├── 📄 DAYS_1-2_COMPLETE.md    # Days 1-2 summary
│   ├── 📄 STRUCTURE.md            # This file
│   └── 📄 API.md                  # (Days 3-4) API documentation
│
├── 🎯 Git & Version Control
│   ├── 📄 .gitignore              # Git exclusions
│   └── (Initialize: git init, git add ., git commit)
│
└── 📄 LICENSE                      # MIT License
```

---

## File Count & Lines of Code

| Category | Files | Lines | Status |
|----------|-------|-------|--------|
| **Source Code** | 5 | 885 | ✅ Complete |
| **Configuration** | 4 | 180 | ✅ Complete |
| **Database** | 1 | 380 | ✅ Complete |
| **Documentation** | 4 | 1500+ | ✅ Complete |
| **Routes** (Days 3-10) | 6 | TBD | ⏳ Pending |
| **Services** (Days 3-10) | 5 | TBD | ⏳ Pending |
| **Middleware** (Days 5-8) | 4 | TBD | ⏳ Pending |
| **Tests** (Days 7-8) | 5 | TBD | ⏳ Pending |
| **TOTAL (Days 1-2)** | **23** | **2,945** | **✅ 100%** |

---

## Core Dependencies

### Production (8)
```
express              - Web framework
stripe               - Payment processing
@supabase/supabase-js - Database client
dotenv               - Environment loading
cors                 - Cross-origin support
helmet               - Security headers
morgan               - HTTP logging
express-rate-limit   - Rate limiting
axios                - HTTP client
```

### Development (14)
```
typescript           - Type checking
@types/*             - Type definitions
ts-node              - TypeScript runner
nodemon              - File watch
eslint               - Code linting
@typescript-eslint/* - TS linting rules
prettier             - Code formatting
jest                 - Testing framework
ts-jest              - Jest + TypeScript
```

---

## Key Directories

### `/src`
Main application source code. All files are TypeScript (.ts).

**Subdirectories**:
- `config/` - Application configuration
- `types/` - Type definitions
- `utils/` - Utilities (error handling, validators)
- `database/` - Database schemas and migrations
- `routes/` - Express route handlers (Days 3-10)
- `services/` - Business logic (Days 3-10)
- `middleware/` - Custom middleware (Days 5-8)
- `__tests__/` - Unit and integration tests (Days 7-8)

### `/dist`
Compiled JavaScript output. Generated by `npm run build`.
Do NOT commit to git (in .gitignore).

### Configuration Files
- `tsconfig.json` - TypeScript compiler settings
- `jest.config.js` - Test runner configuration
- `.eslintrc.json` - Linting rules
- `.prettierrc.json` - Code formatting rules
- `package.json` - Project metadata & scripts

### Documentation
- `README.md` - Getting started
- `GITHUB_SETUP.md` - Git repository setup
- `DAYS_1-2_COMPLETE.md` - Detailed completion report
- `STRUCTURE.md` - This file
- `API.md` (Days 3-4) - API endpoint documentation

---

## File Naming Conventions

### Source Files
- `camelCase.ts` for files
- `UpperCase` for classes
- `UPPER_SNAKE_CASE` for constants

### Test Files
- `*.spec.ts` for unit tests
- `*.test.ts` for integration tests
- Place in `__tests__/` directory

### Configuration Files
- `snake_case.json` or `snake_case.js`
- `.filename` for hidden files (e.g., `.env`)

---

## Import Structure

### Absolute imports (coming Days 3-8)
```typescript
// Instead of:
import { Config } from '../../config';

// Use:
import { Config } from '@/config';
```

Configure in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## Build & Deployment

### Development
```bash
npm run dev          # Watch and reload
npm run watch        # Watch TypeScript
```

### Production
```bash
npm run build        # Compile TypeScript
npm start            # Run compiled code
```

### Output
- Input: `src/**/*.ts`
- Output: `dist/**/*.js`
- Sourcemaps: `dist/**/*.js.map`

### Docker (Future - Days 9-10)
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Development Workflow

### 1. Make changes
```bash
cd src/
# Edit TypeScript files
```

### 2. Watch compilation
```bash
npm run watch
# In another terminal:
npm run dev
```

### 3. Code quality
```bash
npm run lint          # Check style
npm run format        # Auto-format
npm run type-check    # Type safety
```

### 4. Test
```bash
npm test              # Run once
npm run test:watch    # Watch tests
npm run test:coverage # Coverage report
```

### 5. Commit
```bash
git add .
git commit -m "Feature: description"
git push origin feature-branch
```

---

## Next Steps

### Days 3-4: OAuth + Stripe
Create in this order:
1. `src/services/stripe.service.ts` - Stripe integration
2. `src/services/oauth.service.ts` - OAuth handling
3. `src/routes/payment.ts` - Stripe endpoints
4. `src/routes/oauth.ts` - OAuth endpoints
5. `src/middleware/auth.ts` - Token validation
6. `src/__tests__/stripe.spec.ts` - Stripe tests
7. `src/__tests__/oauth.spec.ts` - OAuth tests

### Days 5-6: Recording + Results
Create:
1. `src/services/twilio.service.ts` - Twilio integration
2. `src/services/n8n.service.ts` - n8n deployment
3. `src/routes/call.ts` - Call recording endpoints
4. `src/routes/automation.ts` - Automation results
5. `src/__tests__/twilio.spec.ts` - Twilio tests

### Days 7-8: Monitoring + Security
Add:
1. `src/middleware/logging.ts` - Performance logging
2. `src/middleware/encryption.ts` - Data encryption
3. `src/__tests__/integration.spec.ts` - Integration tests
4. `src/utils/monitoring.ts` - Error tracking

### Days 9-10: Production
Add:
1. `Dockerfile` - Docker containerization
2. `.github/workflows/ci.yml` - GitHub Actions
3. `vercel.json` or `Procfile` - Deployment config
4. `docs/DEPLOYMENT.md` - Deployment guide

---

## Key Files to Review

**For Development**:
- `src/app.ts` - Middleware and routing setup
- `src/config/index.ts` - All configuration
- `src/types/index.ts` - Data models

**For Error Handling**:
- `src/utils/errors.ts` - Error classes and handlers

**For Database**:
- `src/database/schema.sql` - Complete schema

**For Testing**:
- `jest.config.js` - Test configuration
- `.eslintrc.json` - Code quality rules

---

## Debugging Tips

### Enable debug logging
```bash
DEBUG=* npm run dev
```

### Check TypeScript errors
```bash
npm run type-check
```

### Verify config loading
```bash
npm run dev
# Look for: "✅ Configuration validated successfully"
```

### Test endpoints
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/version
```

### Check dependencies
```bash
npm list
npm outdated
```

---

**This structure is optimized for:**
- ✅ Team collaboration
- ✅ Scalability (easy to add services)
- ✅ Testing (organized test files)
- ✅ Deployment (clear build process)
- ✅ Maintenance (logical organization)

**Ready for Days 3-10 development!**
