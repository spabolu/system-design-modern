---
title: Start here
description: Follow a six-level system design curriculum with Azure examples and worked case studies.
sidebar_position: 1
---

System design is the work of turning requirements into a system you can explain,
operate, and change. This personal curriculum starts with the vocabulary, builds
up the common components and patterns, and then applies them to complete designs.
It is for learning how to reason about architecture, not memorizing a diagram.

The curriculum is under construction. Pages with an outline and no explanation
are planned topics, not finished lessons.

## The learning path

Work through the levels in order. If you already know a topic, use its
trade-offs and interview tips to check your understanding before moving on.

1. [Fundamentals](./01-fundamentals) establishes the vocabulary. Start with
   requirements, networking, APIs, estimation, scaling, and consistency.
2. [Building blocks](./02-building-blocks) explains the components you combine.
   Learn how traffic routing, data storage, messaging, search, and identity work.
3. [Patterns](./03-patterns) puts those components together. Study common problems
   such as contention, retries, real-time updates, and multi-step work.
4. [Architecting on Azure](./04-azure) maps design choices to Azure services.
   Consider reliability, security, operations, and cost alongside functionality.
5. [Advanced](./05-advanced) examines coordination and systems with harder
   constraints. Topics include consensus, global writes, stream processing, and AI.
6. [Case studies](./06-case-studies) applies the earlier levels to full designs.
   Start with requirements and estimates, then explain the architecture and the
   decisions that deserve a closer look.

Concept pages link to their own level and earlier levels so you can read in order.
Azure pages and case studies can draw on the whole curriculum.

## How pages are structured

Concept pages in levels 1 through 5 use the same sections:

- **TL;DR** gives the main ideas in three to five bullets.
- **Why it matters** explains the problem.
- **How it works** explains the mechanics with a Mermaid diagram.
- **Trade-offs** names what you gain and what you pay.
- **On Azure** connects the design to services, tiers, and configuration choices.
- **Interview tips** covers common traps and follow-up questions.
- **Further reading** links to the sources behind the explanation.

Case studies begin with **TL;DR**, then work through **Requirements**,
**Capacity estimates**, **Core entities and API**, **High-level design**, and
**Deep dives**. They end with **On Azure**, **Interview tips**, and
**Further reading**. The high-level design and Azure architecture each have a
Mermaid diagram.

## Azure is the only cloud

Every cloud component uses an Azure service. Open-source software such as
PostgreSQL, Redis, Kafka, and Kubernetes still belongs in the discussion.
Research papers keep their original names.

Azure service names, tiers, and limits can change. Pages cite Microsoft Learn
for those facts. Estimates state their assumptions and units, so you can
recalculate them when the workload changes.

## Reference sources

The explanations and diagrams here are original. These references inform the
topic selection, depth, and Azure guidance:

- [Hello Interview, System Design in a Hurry](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)
- [The Coding Gopher on Substack](https://thecodinggopher.substack.com/archive)
- [The Coding Gopher on YouTube](https://www.youtube.com/@TheCodingGopher)
- [Azure Architecture Center](https://learn.microsoft.com/azure/architecture/)
- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)

[Notes](/notes) holds dated observations on new developments. Notes link back to
the curriculum rather than replacing its maintained explanations.
