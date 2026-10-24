# Modern System Design

A system design curriculum that builds from fundamentals to advanced topics,
then applies them in fifteen worked case studies. Every cloud example uses
Microsoft Azure, so the designs double as practice architecting on it.

## Read it

Read the site at <https://red-meadow-0c7d14a0f.4.azurestaticapps.net>. Start at
[Start here](docs/intro.md) and work through the six levels in order.

| Level | What it covers |
| --- | --- |
| [1. Fundamentals](docs/01-fundamentals) | Requirements, networking, APIs, estimation, scaling, availability, and consistency. |
| [2. Building blocks](docs/02-building-blocks) | Load balancers, gateways, caches, databases, replication, sharding, queues, streams, storage, search, and identity. |
| [3. Patterns](docs/03-patterns) | Contention, scaling reads and writes, large files, long-running work, retries, resilience, and event-driven designs. |
| [4. Architecting on Azure](docs/04-azure) | Service choices, the Well-Architected Framework, regions and zones, security, observability, and cost. |
| [5. Advanced](docs/05-advanced) | Consensus, distributed transactions, clocks, CRDTs, stream processing, multi-region writes, cells, AI systems, and production AI agents. |
| [6. Case studies](docs/06-case-studies) | Full designs, from a URL shortener to AI agents for customer support, enterprise research, and clinical notes, in the order of an interview. |

Concept pages explain one topic each, with a diagram, its trade-offs, and how
to build it on Azure. Case studies follow
[Hello Interview's delivery framework](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery),
from requirements through deep dives that climb through Bad, Good, and Great
solutions. [Notes](blog) holds dated observations on new developments.

The explanations and diagrams are original. Topic selection and depth draw on
[Hello Interview](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction),
[The Coding Gopher](https://thecodinggopher.substack.com/archive), and the
[Azure Architecture Center](https://learn.microsoft.com/azure/architecture/).

## Run it locally

Use Node.js 22.

```bash
npm ci
npm start
```

## Contribute

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the curriculum registry, page
templates, and authoring rules.

| Command | What it does |
| --- | --- |
| `npm test` | Runs the behavior tests for the docs lint, scaffold, and link checker. |
| `npm run check` | Runs strict docs lint, then builds the site with broken-link checks. |
| `npm run check:links` | Requests external links and reports failures and unverified responses. |

To add a page, register it in CONTRIBUTING.md, then run
`node scripts/scaffold-stubs.mjs` to create its outline from the template.
Strict lint rejects a page still marked `<!-- stub -->`, so CI stays red until
the outline becomes a complete page.

The link checker treats access restrictions and rate limits as unverified,
not broken. It exits with an error for missing pages or connection failures.

## Deploy

The site is an Azure Static Web App, `swa-system-design-modern` on the Free
plan in the `rg-docusaurus` resource group. Every push to `main` deploys it.
The Check workflow tests and builds the site, and its `deploy` job uploads
that build with the `Azure/static-web-apps-deploy` action.

The action reads the app's deployment token from the
`AZURE_STATIC_WEB_APPS_API_TOKEN` repository secret. To rotate the token,
first run `az staticwebapp secrets reset-api-key -n swa-system-design-modern
-g rg-docusaurus`. Then copy the current token into the secret:

```bash
az staticwebapp secrets list -n swa-system-design-modern -g rg-docusaurus \
  --query properties.apiKey -o tsv |
  gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN
```

The deploy runs on a GitHub Linux runner because the Static Web Apps upload
client ships only for x64, so the Static Web Apps CLI cannot deploy from an
Apple silicon Mac without Rosetta.

`static/staticwebapp.config.json` serves the site's own 404 page for unknown
paths.
