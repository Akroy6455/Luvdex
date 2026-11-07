# Luvdex

A location-based dating app: spot up to 5 people within 500 m, get within 50 m, and throw a Luvball. If they throw one back, it's a match.

- Product & technical plan: [LUVDEX_PLAN.md](LUVDEX_PLAN.md)
- Account setup (Phase 0): [docs/PHASE0_SETUP.md](docs/PHASE0_SETUP.md)

## Run it locally
1. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
2. Run `npm install`, then `npm run web`, and open http://localhost:8081.

Stack: Expo (React Native, web + Android + iOS) · Supabase (Postgres + PostGIS, Auth) · Google Maps · Vercel.
