---
name: create-pr
description: Create a new branch, commit changes, and submit a pull request.
---

## Behavior
- Creates a new branch based on current changes
- Formats modified files using Biome
- Analyzes changes and automatically splits into logical commits when appropriate
- Each commit focuses on a single logical change or feature
- Creates descriptive commit messages for each logical unit
- Pushes branch to remote
- Creates pull request with proper summary and test plan

## General Rules
- Never write yourself a co-author of a commit, nor of a pull-request

## Guidelines for Automatic Commit Splitting
- Split commits by feature, component, or concern
- Keep related file changes together in the same commit
- Separate refactoring from feature additions
- Ensure each commit can be understood independently
- Multiple unrelated changes should be split into separate commits

## Guidelines for Pull Request Description

- Keep it visual: use tables, horizontal rules, and short paragraphs
- No file paths: describe what was done, not where
- Avoid dense walls of text
- Use tables for schemas, before/after comparisons, and procedure summaries
- Use blockquotes for key callouts
