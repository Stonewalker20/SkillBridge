# Frontend

React + Vite client for SkillBridge.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run lint:fix
npm test
npm run test:watch
```

## Notes

- The workspace uses npm, backed by `package-lock.json`.
- The lint setup is flat-config based in `eslint.config.js`.
- Vitest runs in Node for the current baseline smoke test.
- Use `frontend/.env.staging.example` and `frontend/.env.production.example` for deployed builds.
- `VITE_API_BASE` should point at the public backend base URL for the target environment.
- See `../docs/env_matrix.md` and `../docs/deployment_guide.md` for deployment setup.
