// Tests never read a developer's .env.local: every setting they depend on is explicit.
delete process.env.PORTAL_SEED_DEMO;
delete process.env.PORTAL_BOOTSTRAP_ADMIN_EMAIL;
delete process.env.PORTAL_BOOTSTRAP_ADMIN_PASSWORD;
delete process.env.PORTAL_TIMEZONE;
delete process.env.PORTAL_TRUSTED_PROXY_HOPS;
