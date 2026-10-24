# Modern System Design

A personal system design curriculum that builds from fundamentals to advanced
topics and worked case studies. Every cloud example uses Microsoft Azure.
Notes holds dated observations on new developments and links them back to the
curriculum.

## Local development

Use Node.js 22 and install dependencies with `npm install`.

| Command | What it does |
| --- | --- |
| `npm start` | Starts the local development server. |
| `npm run check` | Runs strict docs lint, then builds the production site with broken-link checks. |
| `npm test` | Runs the docs lint, scaffold, and link checker behavior tests. |
| `npm run check:links` | Requests external links and reports failures and unverified responses. |

Strict docs lint rejects unfinished pages marked `<!-- stub -->`. While the
curriculum is under construction, use `node scripts/check-docs.mjs` to check
structure with stub warnings and `npm run build` to build the site separately.
The strict check and CI stay red until the stubs become complete pages.

The link checker treats access restrictions and rate limits as unverified,
not broken. It exits with an error for missing pages or connection failures.

## Add a page

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the curriculum registry, page
templates, and authoring rules.

After updating the registry, run `node scripts/scaffold-stubs.mjs` to create
missing outlines. The generator leaves existing pages and categories unchanged.
