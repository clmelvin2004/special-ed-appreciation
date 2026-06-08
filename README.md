# Staff Appreciation Garden

A TypeScript web app for a private-feeling teacher appreciation card that can be sent by email to selected school board colleagues. Guests enter the passkey they received, then see a personalized digital garden with their schools, their messages, and a stream of appreciation notes.

The app is built as a static Vite site so it can deploy to GitHub Pages.

## Features

- Passkey gate backed by JSON data.
- Guest-specific names, schools, signatures, and personalized messages.
- Universal appreciation messages mixed into every guest's stream.
- Code-generated garden visuals; no external image assets.
- Click or press `Enter`/`Space` on the card to bloom varied flowers.
- Flowers persist per guest in local storage.
- GitHub Pages deployment workflow included.

## Customize Guests

Edit `public/data/guests.json`.

Each guest needs:

- `id`: stable lowercase identifier.
- `passkey`: the value to email to that person.
- `name`: display name after sign-in.
- `schools`: schools shown on the card.
- `signature`: closing line on the card.
- `messages`: personalized notes that join the universal message stream.

Sample passkeys currently included:

- `GARDEN-MARIA-2026`
- `GARDEN-JORDAN-2026`
- `GARDEN-ANYA-2026`

GitHub Pages is static hosting, so the JSON passkeys are a lightweight gate, not secure authentication. Do not put private student, staff, or confidential school information in this app.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production output goes to `dist`.

## Deploy To GitHub Pages

The workflow is in `.github/workflows/deploy.yml`. In the repository settings, set Pages source to GitHub Actions.

`vite.config.ts` currently uses:

```ts
base: '/teacherappreciation/',
```

That matches a repository Pages URL like `https://<username>.github.io/teacherappreciation/`. If the repository name changes, update the base path to `/<repo-name>/`. For a user/org Pages site or custom domain, set the base to `/`.
