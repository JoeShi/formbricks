# Product Overview

Formbricks is an open-source experience management and survey platform (self-described as "The Open Source Qualtrics Alternative"). It lets teams create and deploy surveys across multiple channels:

- In-app surveys targeted at specific user segments
- Website surveys embedded on public pages
- Link surveys shared via URL
- Email surveys

The platform includes a no-code survey editor, pre-built templates, response analytics, and integrations with tools like Slack, Notion, Zapier, and n8n.

## Licensing Model

- Core: AGPLv3 open source, fully self-hostable via Docker
- Enterprise features: Located in `apps/web/modules/ee/`, require a separate license key
- Cloud hosted version available at app.formbricks.com

## Key Domain Concepts

- Organization: Top-level tenant; all data is scoped by organization
- Project/Workspace: A project within an organization (recently renamed from "project" to "workspace" in URLs)
- Environment: Deployment context (e.g., development, production) within a project
- Survey: The core entity — a set of questions with targeting rules, styling, and logic
- Response: A user's submission to a survey
- Contact: An identified end-user who can be targeted with surveys
- Action Class: Events that trigger survey display (e.g., page view, button click)
- Integration: Third-party connections (Slack, Google Sheets, Airtable, webhooks, etc.)
