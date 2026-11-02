# deskr-feedback Worker

Saves answers from the uninstall survey (`bye.html`, opened by Chrome when Deskr is
removed) to the D1 database `deskr-feedback`. The site itself is static on Coolify;
this Worker only handles `POST deskr.cc/api/uninstall-feedback` at Cloudflare.

## First setup

```bash
cd worker
npx wrangler login
npx wrangler d1 create deskr-feedback        # put the printed database_id into wrangler.toml
npx wrangler d1 execute deskr-feedback --remote --file schema.sql
npx wrangler deploy
```

## Deploy a change

```bash
cd worker && npx wrangler deploy
```

## Read answers

```bash
npx wrangler d1 execute deskr-feedback --remote --command "SELECT * FROM uninstall_feedback ORDER BY id DESC LIMIT 50"
```

Or Cloudflare dashboard → Storage & Databases → D1 → deskr-feedback → Console.
