# Authoring guide

This site is a personal, maintained curriculum on modern system design. Pages build from fundamentals to advanced topics, and every cloud example uses Microsoft Azure.

Run `npm run check` before every commit. It runs the docs lint (`scripts/check-docs.mjs --strict`) and a production build that fails on broken links.

## Curriculum

The sidebar is generated from the `docs/` folders, so the folder and file names below are the canonical slugs. Link between pages with relative file paths, such as `[caching](../02-building-blocks/caching.md)`.

| Level | Folder | Pages, in sidebar order |
| --- | --- | --- |
| 1. Fundamentals | `docs/01-fundamentals/` | `what-is-system-design`, `interview-framework`, `networking-essentials`, `api-design`, `back-of-the-envelope`, `scalability`, `availability-and-reliability`, `consistency-and-cap` |
| 2. Building blocks | `docs/02-building-blocks/` | `load-balancing`, `api-gateway`, `caching`, `cdn-and-edge`, `databases-sql-vs-nosql`, `indexing`, `replication`, `sharding-and-partitioning`, `consistent-hashing`, `message-queues`, `event-streaming`, `blob-storage`, `search`, `identity-and-auth` |
| 3. Patterns | `docs/03-patterns/` | `real-time-updates`, `handling-contention`, `scaling-reads`, `scaling-writes`, `large-blobs`, `long-running-tasks`, `multi-step-processes`, `idempotency-and-retries`, `resilience-patterns`, `event-driven-cqrs-event-sourcing`, `microservices-vs-monolith` |
| 4. Architecting on Azure | `docs/04-azure/` | `azure-service-map`, `well-architected-framework`, `regions-zones-and-resiliency`, `compute-choices`, `data-choices`, `messaging-choices`, `networking-and-security`, `observability`, `cost-optimization` |
| 5. Advanced | `docs/05-advanced/` | `consensus-raft-paxos`, `distributed-transactions`, `time-clocks-and-ordering`, `crdts-and-local-first`, `stream-processing`, `multi-region-active-active`, `cell-based-architecture`, `ai-systems-rag-and-agents`, `llm-serving-and-inference` |
| 6. Case studies | `docs/06-case-studies/` | `url-shortener`, `rate-limiter`, `news-feed`, `chat-messaging`, `ticket-booking`, `ride-sharing`, `video-streaming`, `file-sync`, `web-crawler`, `top-k-leaderboard`, `ad-click-aggregator`, `ai-chat-assistant` |

A page may only link to pages at its own level or below, except case studies and `04-azure`, which may link anywhere. This keeps the path from basics to advanced readable in order.

## Page templates

Copy a template from `templates/`. Every page is Markdown (`.md`) with this frontmatter:

```yaml
---
title: Caching
description: One sentence that says what the reader learns.
sidebar_position: 3
---
```

`sidebar_position` matches the page's position in the curriculum table.

A concept page (levels 1 to 5) has these `##` sections, in this order. Add `###` subsections freely.

1. `## TL;DR`. Three to five bullets.
2. `## Why it matters`. The problem this solves, in one or two paragraphs.
3. `## How it works`. The mechanics, with at least one Mermaid diagram.
4. `## Trade-offs`. A table or list of what you gain and what you pay.
5. `## On Azure`. Which Azure services implement this, which tier or SKU matters, and the configuration choices that matter in a design.
6. `## Interview tips`. What to say, common traps, and the follow-up questions to expect.
7. `## Further reading`. Links you opened and confirmed.

A case study (level 6) has these `##` sections, in this order.

1. `## TL;DR`
2. `## Requirements`. Functional and non-functional, as two lists.
3. `## Capacity estimates`
4. `## Core entities and API`
5. `## High-level design`. With a Mermaid diagram.
6. `## Deep dives`
7. `## On Azure`. A reference architecture as a Mermaid diagram labelled with Azure service names, plus a table mapping each component to its service.
8. `## Interview tips`
9. `## Further reading`

## Rules

- **Azure only.** Name Azure services for every cloud component. Never name another cloud provider or its services. Open-source software (Kafka, Redis, PostgreSQL, Kubernetes, Elasticsearch) is fine, and so is naming the Azure service that hosts it. Research papers keep their names (the Dynamo paper, Spanner and TrueTime). `scripts/check-docs.mjs` enforces this with a banned-term list.
- **Current Azure facts.** Azure renames and retires services. Confirm each service name, SKU, and limit on `learn.microsoft.com` before you write it, and prefer the current product over a retiring one.
- **Original writing.** Hello Interview and The Coding Gopher are the reference material for which topics matter and how deep to go. Write every explanation in your own words and draw your own diagrams. Never copy their text, and link to them in Further reading.
- **No invented links.** Every external link must be a page you opened. `npm run check:links` requests every external link and reports the ones that fail.
- **Diagrams are Mermaid.** Use fenced `mermaid` code blocks. Prefer `flowchart LR` for architectures and `sequenceDiagram` for request flows.
- **Numbers carry units and a source.** Latency, throughput, and limits state their unit, and Azure limits cite the Learn page they came from.

## Reference sources

- [Hello Interview, System Design in a Hurry](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)
- [The Coding Gopher on Substack](https://thecodinggopher.substack.com/archive)
- [The Coding Gopher on YouTube](https://www.youtube.com/@TheCodingGopher)
- [Azure Architecture Center](https://learn.microsoft.com/azure/architecture/)
- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)
