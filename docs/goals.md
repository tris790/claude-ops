## High Level Goal
** Be an alternative frontend to Azure DevOps**

## Motiviation
Azure DevOps is slow, clunky, lacks developer oriented features, and is overall a subpar experience.

## Goals
- Always stay fast and responsive even with humongous datasets (repos, work items, files, pipeline runs)
- Provide a way to
    - Search work items (fuzzy search, regex, filtering by projects, date, devs, etc.)
    - Search code with advanced features (fuzzy search, regex, filtering by projects, date, devs, etc.)
    - Code review with advanced features (code navigation, diff view, and comments, intelisense, reload comments/code changes, review file checkboxes, leave comments, etc.)
    - Be able to start pipelines (for any branch, and be able to view progress)
    - List all pull request under a work item (could be a tree eg: epic -> features -> work items -> pull requests)
    - List and search commits
    - Navigate code in the browser from the repos

## Information
- There will be multiple teams, projects under the same organization
- The orgnization can change (url, be self hosted, private, etc.) but it will be compatible with Azure DevOps API
- We can use the Azure DevOps API to get the data
- We can explore having the repos locally (managed by this app) to speed up the experience but we need to investigate if this is a good idea
- Users will provide required info to connect to the orgnization (url, token, etc.)
- The app will be hosted locally