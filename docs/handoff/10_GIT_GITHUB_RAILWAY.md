# GIT, GITHUB & RAILWAY WORKFLOW

## Principle
GitHub canonical source sejak project initialization. Local untuk coding/testing.

## Day-0
1. Create GitHub repository.
2. Initialize app.
3. Commit foundation.
4. Push remote.
5. Create Railway project.
6. Connect Railway to GitHub.
7. Production deploy from `main`.
8. Optional staging from `develop`.
9. Verify environment variables + health endpoint.

## Branching
- main = production
- develop = integration/staging
- feature/* optional

## Commit Policy
Setelah setiap logical task selesai: run relevant checks, focused commit.

## Push Policy
Commit per task. Push develop per completed stage/milestone atau lebih sering sebagai backup. Merge main hanya jika acceptance milestone pass. Railway Production track main.

## CI Gate
lint, typecheck, unit tests, calculation fixtures, build.

## Secrets
Jangan commit secrets. Railway env vars. `.env.example` hanya names/placeholders.

## Release Tags
- v0.0-foundation
- v0.1-generate-1

## Production Target
M8 Generate #1 harus live, usable, persistent, DOCX/PDF working.
