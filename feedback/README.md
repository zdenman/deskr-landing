# deskr-feedback

Emails each answer from the uninstall survey (`bye.html`, opened by Chrome when
Deskr is removed). No database: an answer is checked and sent to `FEEDBACK_TO`
through Amazon SES, the same way Taskr sends mail. About 25 MB of RAM.

## Coolify (Atlas)

New resource → Application → this repo (`zdenman/deskr-landing`, branch `main`):

- Build pack: **Dockerfile**, base directory **`/feedback`**, port **3000**
- Domain: **`https://deskr.cc/api/uninstall-feedback`** (path route next to the static site)
- Watch paths: `feedback/**` so landing page edits don't rebuild it
- Environment variables (same SES account as Taskr):
  - `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - `MAIL_FROM`: a sender SES has verified, e.g. `Deskr <noreply@taskr.cc>` (or a deskr.cc address once deskr.cc is verified in SES)
  - `FEEDBACK_TO`: where answers go

Health check: `GET /health`. Any `POST` path is handled, so it works whether or not
the proxy strips the `/api/uninstall-feedback` prefix.

## Locally

```bash
npm install && npm start   # without AWS settings, emails are only logged
curl -H 'Accept: application/json' -F reason=bug -F comment=hi localhost:3000/
```
