# NumaStudio

A graphical drag-and-drop editor for building and managing **Numaflow** pipeline configuration files. Design vertices (sources, UDFs, sinks), connect them with edges, edit YAML in place, and export or import pipeline specs that match the Numaflow API.

## Features

- **Visual pipeline editor** — Canvas built with React Flow: drag nodes from the sidebar, connect them with edges, and rearrange the graph.
- **Vertex types** — Add and configure **sources**, **UDFs** (map/reduce scripts), and **sinks** with inline YAML editing in modals.
- **Edge configuration** — Click an edge to set conditions (e.g. routing) and save them back to the pipeline.
- **Import / export** — Load pipeline YAML from file or repository and export the current graph as Numaflow pipeline YAML (`apiVersion: numaflow.numaproj.io/v1alpha1`, `kind: Pipeline`).
- **Repository integration** — Browse files, view pipeline YAML from a repo, and optionally use a local proxy for Git operations in development.

## Prerequisites

- **Node.js** 18+
- **npm** (or compatible package manager)

For deployment:

- **Docker** (and optionally **Kind**) for container images
- **kubectl** and Kubernetes manifests if you deploy to a cluster

## Getting started

### Install dependencies

```bash
npm install
```

### Run the app (development)

```bash
npm run dev
```

The Vite dev server will start (default: http://localhost:5173). Open that URL in your browser.

### Optional: Git proxy (development)

If you use repository or Git features that need to reach GitHub (or another host), run the CORS proxy in a separate terminal:

```bash
npm run proxy
```

This starts the proxy on http://localhost:3001 and forwards requests to the configured target (e.g. GitHub).

## Ports

| Context        | Service   | Port  | Notes                                      |
|----------------|-----------|-------|--------------------------------------------|
| **Development**| App (Vite)| 5173  | Default; open http://localhost:5173        |
| **Development**| Git proxy | 3001  | Used when repo/Git features need CORS     |
| **Docker**     | Web app   | 80    | nginx in container (EXPOSE 80)             |
| **Docker**     | Proxy     | 3001  | Proxy container                            |
| **Kubernetes** | Web app   | 80 (NodePort 30001) | Access app at `<node-ip>:30001`   |
| **Kubernetes** | Proxy     | 3001  | ClusterIP; reachable only inside cluster  |

## Scripts

| Command       | Description                    |
|---------------|--------------------------------|
| `npm run dev` | Start Vite dev server          |
| `npm run build` | Production build (output in `dist/`) |
| `npm run preview` | Preview production build locally |
| `npm run proxy` | Start CORS proxy for Git (dev) |
| `npm run lint` | Run ESLint                     |

## Build for production

```bash
npm run build
```

Static assets are written to `dist/`. The Dockerfile uses this output and serves it with nginx.

## Deployment

The repo includes Dockerfiles and Kubernetes manifests for running the app (and optionally the proxy) in a cluster.

### Deploy on a Kind cluster

Kind runs nodes in Docker, so NodePorts are not reachable from the host unless you map them. Use a Kind config with `extraPortMappings` so that the webapp NodePort (30001) is exposed on localhost. Example `kind-config.yaml`:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      # NumaStudio webapp (NodePort 30001)
      - containerPort: 30001
        hostPort: 30001
        protocol: TCP
  - role: worker
```

Save this as `kind-config.yaml` in the project root (or use the one in this repo), then create the cluster with it.

1. **Create a Kind cluster** using the config:

   ```bash
   kind create cluster --name my-cluster --config kind-config.yaml
   ```

   The `kind-config.yaml` in this repo maps `hostPort: 30001` → `containerPort: 30001`, so you can open **http://localhost:30001** after deploying. If you need more ports (e.g. for other apps), add more entries under `extraPortMappings` in that file.

2. **Build the images** (from the project root):

   ```bash
   docker build -f Dockerfile.app -t numagui:latest .
   docker build -f Dockerfile.proxy -t numagui-proxy:latest .
   ```

3. **Load images into Kind** (Kind can’t pull from the local Docker registry by default):

   ```bash
   kind load docker-image numagui:latest --name my-cluster
   kind load docker-image numagui-proxy:latest --name my-cluster
   ```

4. **Apply the manifests**:

   ```bash
   kubectl apply -f manifests/webapp-deployment.yaml
   kubectl apply -f manifests/proxy-deployment.yaml
   kubectl apply -f manifests/proxy-service.yaml
   kubectl apply -f manifests/webapp-service.yaml
   ```

5. **Access the app**  
   The webapp Service is type `NodePort` with **nodePort: 30001**. Get a node address and open the app in your browser:

   ```bash
   kubectl cluster-info --context kind-my-cluster
   ```

   If using Kind on the same machine, use **http://localhost:30001** (Kind typically exposes node ports on localhost). Otherwise use `<node-ip>:30001`.

6. **Optional: check pods and services**

   ```bash
   kubectl get pods
   kubectl get svc
   ```

To tear down the cluster:

```bash
kind delete cluster --name my-cluster
```

See `manifests/deployment-instructions.txt` for a compact copy of the build-and-deploy commands.

## Tech stack

- **React 19** + **Vite 7**
- **@xyflow/react** (React Flow) for the pipeline canvas
- **Monaco Editor** (via `@monaco-editor/react`) for YAML editing
- **js-yaml** for pipeline parsing and serialization
- **isomorphic-git** + **BrowserFS** for repository features

