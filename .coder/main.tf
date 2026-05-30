terraform {
  required_providers {
    coder = {
      source = "coder/coder"
    }
    docker = {
      source = "kreuzwerker/docker"
    }
  }
}

provider "docker" {
}

data "coder_provisioner" "me" {
}

data "coder_workspace" "me" {
}

resource "coder_agent" "main" {
  arch           = data.coder_provisioner.me.arch
  os             = "linux"
  startup_script = <<-EOT
    set -e

    # Install dependencies
    sudo apt-get update
    sudo apt-get install -y curl git unzip

    # Install Deno
    curl -fsSL https://deno.land/x/install/install.sh | sh
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"

    # Install Node.js (via nvm or direct)
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs

    # Clone the repo if it's not already there
    if [ ! -d "rocketboard-ai-guide" ]; then
      git clone https://github.com/knarayanareddy/rocketboard-ai-guide.git
    fi

    # Start the development server (optional, not running as per request)
    echo "Coder environment ready. Use 'cd rocketboard-ai-guide' to start developing."
  EOT

  metadata {
    display_name = "CPU Usage"
    key          = "0_cpu_usage"
    script       = "coder stat cpu"
    interval     = 10
    timeout      = 1
  }

  metadata {
    display_name = "Memory Usage"
    key          = "1_mem_usage"
    script       = "coder stat mem"
    interval     = 10
    timeout      = 1
  }
}

resource "docker_volume" "home_volume" {
  name = "coder-$${data.coder_workspace.me.id}-home"
  # Protect the volume from being deleted if the workspace is deleted
  lifecycle {
    ignore_changes = all
  }
}

resource "docker_container" "workspace" {
  count = data.coder_workspace.me.start_count
  image = "codercom/enterprise-base:ubuntu"
  # Handle workspace name
  name = "coder-$${data.coder_workspace.me.owner}-$${lower(data.coder_workspace.me.name)}"
  # Hostname
  hostname = data.coder_workspace.me.name
  # Use the agent token
  entrypoint = ["sh", "-c", coder_agent.main.init_script]
  env        = ["CODER_AGENT_TOKEN=$${coder_agent.main.token}"]
  
  host {
    host = "host.docker.internal"
    ip   = "host-gateway"
  }

  volumes {
    container_path = "/home/coder"
    volume_name    = docker_volume.home_volume.name
    read_only      = false
  }
}
