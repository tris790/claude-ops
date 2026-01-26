# 3 Automation
Users want to be able to automate tasks on their computer triggered by action in the UI.
Usecases:
- User wants to be able to task an llm to apply changes to the pr based on a comment on his pr. For example another user commented on his pr to rewrite a part of the code to be more performant. The user should be able to click a button and we trigger an agent to apply the changes and commit. Most users will use claude code to do this so `claude "Apply the following changes to the branch: '{{branch}}' commmit and push"` but we should also support modfiying the command in the settings so users can do what they want. The icon in the UI should be an AI magic sparks.

- user wants to be able to select code in a diff view and either send it as a comment of ask an AI for some insights. `claude "${user_message} ${selected_code}"`

- user wants to be able to select code in a file view and ask an AI for some insights. `claude "${user_message} ${selected_code}"`

- user wants to be able to ask an AI to write the pr description. `claude "Write a pr description for the changes between main and {{branch}}"`

- user wants to be able to dispatch an agent to create a draft pr of the work item implemented. The agent should work autonomously and find the pr, create a plan, then spawn sub agents to implement the changes and commit. The agent should create a draft pr with the commit. The main agents is encouraged to use mcp servers such as Azure or Confluence to gather as much info and create a comprehensive plan.