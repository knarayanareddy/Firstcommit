# Coder Template: RocketBoard AI Guide

This directory contains a Coder template that provisions a Docker-based development environment for the **RocketBoard AI Guide** project.

## Prerequisites

1.  **Coder Deployment**: You must have access to a running Coder instance.
2.  **Coder CLI**: Install the Coder CLI on your local machine:
    ```bash
    curl -L https://coder.com/install.sh | sh
    ```
3.  **Docker**: The Coder host must have Docker installed and accessible to the Coder service.

## Setup Instructions

### 1. Authenticate with Coder
Login to your Coder deployment:
```bash
coder login <your-coder-url>
```

### 2. Create the Template
Push the template from this directory to your Coder instance:
```bash
# From the root of the repository
coder templates create rocketboard -d .coder
```

### 3. Create a Workspace
Once the template is pushed, you (or your team) can create a workspace via the Coder UI or CLI:
```bash
coder create my-rocketboard --template rocketboard
```

### 4. Open in VS Code
After the workspace starts, you can connect to it via SSH or use the Coder VS Code extension to open the code directly in the remote container.

---

## Technical Details

- **Base Image**: `codercom/enterprise-base:ubuntu`
- **Provisioning**: Uses Terraform with the `coder` and `docker` providers.
- **Pre-installed Tools**:
  - Deno
  - Node.js (v18)
  - Git
- **Persistence**: A Docker volume is created to persist the `/home/coder` directory across workspace restarts.
