# Contributing

## Database Migrations

Apply migrations **locally**:
```sh
npx wrangler d1 migrations apply what-about-that-time-events
```

Apply migrations to **production**:
```sh
npx wrangler d1 migrations apply what-about-that-time-events --remote
```

Create a **new migration**:
```sh
npx wrangler d1 migrations create what-about-that-time-events <description>
```
This creates a new `.sql` file in `migrations/`. Write your SQL, then apply it.

## Dev

```sh
npm run dev
```

## Type Generation

After changing `wrangler.jsonc` bindings:
```sh
npx wrangler types
```
