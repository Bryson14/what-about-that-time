# Personal and Family Timeline Creator and Editor

Used for my own personal use, built on Astro and Cloudflare. 

## Best Practices

- Write typescript where possible
- Use OTEL logging.ts helper so server logs are captured on CloudFlare
- Avoid bringing in dependancies
- Run `pnpm astro check` to check typescript errors and `pnpm fallow` to check for code health lints.
- Run `pnpm build` to check that it can build (does not check ts errors)
- Use Zod liberally where inputs are unknown for better type safety.