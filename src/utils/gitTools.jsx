import * as git from 'isomorphic-git';
import * as http from 'isomorphic-git/http/web';
import * as BrowserFSRaw from 'browserfs';

// BrowserFS can export as default or namespace depending on bundler; normalize here
const BrowserFS = BrowserFSRaw.default || BrowserFSRaw;

// Initialize BrowserFS with IndexedDB backend for a specific repository
async function initBrowserFS(repoName) {
    return new Promise((resolve, reject) => {
        BrowserFS.configure({
            fs: "IndexedDB",
            options: {
                storeName: `git-repo-${repoName}` // Unique store for each repo
            }
        }, (e) => {
            if (e) return reject(e);
            const fs = BrowserFS.BFSRequire('fs');
            const path = BrowserFS.BFSRequire('path');
            // Make Buffer available globally for isomorphic-git
            if (typeof globalThis.Buffer === 'undefined') {
                globalThis.Buffer = BrowserFS.BFSRequire('buffer').Buffer;
            }
            resolve({ fs, path });
        });
    });
}

// Promise wrappers around BrowserFS (callback-style) APIs
const pStat = (fs, p) => new Promise((res, rej) => fs.stat(p, (err, stat) => err ? rej(err) : res(stat)));
const pMkdir = (fs, p) => new Promise((res, rej) => fs.mkdir(p, { recursive: true }, (err) => err ? rej(err) : res()));
const pReaddir = (fs, p) => new Promise((res, rej) => fs.readdir(p, (err, files) => err ? rej(err) : res(files)));
const pWriteFile = (fs, p, data) => new Promise((res, rej) => fs.writeFile(p, data, (err) => err ? rej(err) : res()));
const pReadFile = (fs, p) => new Promise((res, rej) => fs.readFile(p, (err, data) => err ? rej(err) : res(data)));

async function ensureDir(fs, pathMod, dir) {
    const parts = dir.split('/').filter(Boolean);
    let current = '/';
    for (const part of parts) {
        current = pathMod.join(current, part);
        try {
            const stat = await pStat(fs, current);
            if (!stat.isDirectory()) {
                throw new Error(`${current} exists and is not a directory`);
            }
        } catch (err) {
            await pMkdir(fs, current);
        }
    }
}

async function writeFileEnsuringDir(fs, pathMod, fullPath, data) {
    const dir = pathMod.dirname(fullPath);
    await ensureDir(fs, pathMod, dir);
    await pWriteFile(fs, fullPath, data);
}

async function syncRepositoryFiles(fs, pathMod, repoDir, repository, createRequirementsTxt = false) {
    if (!repository) return;

    // Note: We don't store repo-metadata.json anymore - metadata is tracked in git config and registry
    // The repository name and timestamps are available from git commits and the registry

    // pipeline.yaml
    if (repository.pipeline) {
        await writeFileEnsuringDir(fs, pathMod, pathMod.join(repoDir, 'pipeline.yaml'), repository.pipeline);
    }

    // requirements.txt - only create when initializing a new repository (not when cloning)
    if (createRequirementsTxt) {
        await writeFileEnsuringDir(fs, pathMod, pathMod.join(repoDir, 'requirements.txt'), 'pynumaflow\n');
    }

    // scripts
    for (const [scriptName, scriptData] of Object.entries(repository.scripts || {})) {
        const sanitizedName = scriptName.replace(/[^a-zA-Z0-9-_]/g, '_');
        const scriptContent = typeof scriptData === 'string' ? scriptData : (scriptData.data || scriptData);
        await writeFileEnsuringDir(fs, pathMod, pathMod.join(repoDir, 'scripts', `${sanitizedName}.py`), scriptContent);
    }

    // dockerfiles
    for (const [scriptName] of Object.entries(repository.scripts || {})) {
        const sanitizedName = scriptName.replace(/[^a-zA-Z0-9-_]/g, '_');
        const dockerfileContent = `FROM python:3.10-slim
WORKDIR /app
COPY . /app
RUN pip install -r requirements.txt
CMD ["python", "-u", "${sanitizedName}.py"]`;
        await writeFileEnsuringDir(fs, pathMod, pathMod.join(repoDir, 'dockerfiles', sanitizedName, 'Dockerfile'), dockerfileContent);
    }

    // manifests
    for (const [manifestName, manifestContent] of Object.entries(repository.manifests || {})) {
        const content = typeof manifestContent === 'string' ? manifestContent : JSON.stringify(manifestContent);
        await writeFileEnsuringDir(fs, pathMod, pathMod.join(repoDir, 'manifests', manifestName), content);
    }
}

async function getAllFiles(fs, pathMod, baseDir) {
    const results = [];

    async function walk(current) {
        let entries = [];
        try {
            entries = await pReaddir(fs, current);
        } catch (e) {
            return;
        }

        for (const entry of entries) {
            const fullPath = pathMod.join(current, entry);
            try {
                const stat = await pStat(fs, fullPath);
                if (stat.isDirectory()) {
                    if (entry === '.git') continue; // skip .git
                    await walk(fullPath);
                } else {
                    results.push(fullPath);
                }
            } catch (e) {
                // ignore
            }
        }
    }

    await walk(baseDir);
    return results;
}

// Load repository metadata and files from BrowserFS
async function loadRepositoryFromFS(fs, pathMod, repoDir, repoName) {
    const repository = {
        name: repoName, // Use provided repoName instead of deriving from path
        pipeline: null,
        scripts: {},
        dockerfiles: {},
        manifests: {},
        createdAt: null // Will be set from registry if available
    };

    try {
        // Try to get createdAt from git config or first commit
        // For now, we'll rely on the registry for metadata

        // Load pipeline.yaml
        try {
            const pipelinePath = pathMod.join(repoDir, 'pipeline.yaml');
            const pipelineContent = await pReadFile(fs, pipelinePath);
            repository.pipeline = pipelineContent.toString();
        } catch (e) {
            // pipeline.yaml doesn't exist
        }

        // Load scripts
        try {
            const scriptsDir = pathMod.join(repoDir, 'scripts');
            const scriptFiles = await pReaddir(fs, scriptsDir);
            for (const scriptFile of scriptFiles) {
                if (scriptFile.endsWith('.py')) {
                    const scriptPath = pathMod.join(scriptsDir, scriptFile);
                    const scriptContent = await pReadFile(fs, scriptPath);
                    const scriptName = scriptFile.replace('.py', '');
                    repository.scripts[scriptName] = scriptContent.toString();
                }
            }
        } catch (e) {
            // scripts directory doesn't exist
        }

        // Load manifests
        try {
            const manifestsDir = pathMod.join(repoDir, 'manifests');
            const manifestFiles = await pReaddir(fs, manifestsDir);
            for (const manifestFile of manifestFiles) {
                const manifestPath = pathMod.join(manifestsDir, manifestFile);
                const manifestContent = await pReadFile(fs, manifestPath);
                repository.manifests[manifestFile] = manifestContent.toString();
            }
        } catch (e) {
            // manifests directory doesn't exist
        }
    } catch (error) {
        console.error('Error loading repository from filesystem:', error);
    }

    return repository;
}

// Clone git repository from GitHub
export async function cloneGitRepository(repoName, gitUrl) {
    const { fs, path } = await initBrowserFS(repoName);
    const repoDir = '/';

    await ensureDir(fs, path, repoDir);

    try {
        // Add to simple localStorage list
        addRepoToList(repoName);

        // Local CORS proxy for development (remove in production)
        // Replace github.com with localhost:3001 to use local proxy
        const LOCAL_PROXY = 'http://localhost:3001';
        const proxiedUrl = gitUrl.replace('https://github.com', LOCAL_PROXY);

        // Clone the repository
        await git.clone({
            fs,
            http,
            dir: repoDir,
            url: proxiedUrl,
            singleBranch: true,
            depth: 1
        });

        return { fs, path, dir: repoDir };
    } catch (error) {
        console.error('Error cloning git repository:', error);
        throw error;
    }
}

// Initialize git repository (per repo directory under /)
export async function initGitRepository(repository, existingGit = false) {
    const { fs, path } = await initBrowserFS(repository.name);
    const repoDir = '/';

    await ensureDir(fs, path, repoDir);

    try {
        if (!existingGit) {
            // Add to simple localStorage list
            addRepoToList(repository.name);
            
            // Only initialize if Git doesn't already exist
            // Create requirements.txt only for new repository initialization
            await syncRepositoryFiles(fs, path, repoDir, repository, true);

            await git.init({
                fs,
                dir: repoDir,
                defaultBranch: 'main'
            });

            // Create initial commit
            await addAndCommit({ fs, path, dir: repoDir }, 'Initial commit');
        } else {
            // Git already exists, just sync repository files (don't create requirements.txt)
            await syncRepositoryFiles(fs, path, repoDir, repository, false);
        }

        return { fs, path, dir: repoDir };
    } catch (error) {
        console.error('Error initializing git repository:', error);
        throw error;
    }
}

// Add all files (excluding .git) and commit
export async function addAndCommit(gitCtx, message = 'Update repository') {
    const { fs, path, dir } = gitCtx;
    try {
        const allFiles = await getAllFiles(fs, path, dir);

        for (const file of allFiles) {
            const relativePath = path.relative(dir, file);
            try {
                await git.add({
                    fs,
                    dir,
                    filepath: relativePath
                });
            } catch (error) {
                console.warn(`Could not add file ${file}:`, error);
            }
        }

        // Check if there are changes to commit
        const status = await git.statusMatrix({ fs, dir });
        const hasChanges = status.some(([, headStatus, workdirStatus, stageStatus]) => {
            return headStatus !== workdirStatus || workdirStatus !== stageStatus;
        });

        if (!hasChanges) {
            console.log('No changes to commit');
            return;
        }

        await git.commit({
            fs,
            dir,
            message,
            author: {
                name: 'Numaflow GUI',
                email: 'gui@numaflow.local'
            }
        });

        return true;
    } catch (error) {
        console.error('Error adding and committing:', error);
        throw error;
    }
}

// Update git repository with new repository state
export async function updateGitRepository(gitCtx, repository, commitMessage = 'Update repository') {
    if (!gitCtx) {
        // Initialize if not already initialized
        gitCtx = await initGitRepository(repository, false);
    }

    const { fs, path, dir } = gitCtx;

    // Sync filesystem with current repository state (don't create requirements.txt on updates)
    await syncRepositoryFiles(fs, path, dir, repository, false);

    // Add and commit changes
    await addAndCommit({ fs, path, dir }, commitMessage);

    return gitCtx;
}

// Check if Git repository already exists
export async function gitRepositoryExists(repository) {
    try {
        const { fs, path } = await initBrowserFS(repository.name);
        const repoDir = '/';
        try {
            const stat = await pStat(fs, path.join(repoDir, '.git'));
            return stat.isDirectory();
        } catch (e) {
            return false;
        }
    } catch (error) {
        return false;
    }
}

// Simple localStorage-based repository list (barebones approach)
const REPOS_STORAGE_KEY = 'numaflow-repos';

function getReposList() {
    try {
        const stored = localStorage.getItem(REPOS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function saveReposList(repos) {
    try {
        localStorage.setItem(REPOS_STORAGE_KEY, JSON.stringify(repos));
    } catch (e) {
        console.error('Error saving repos list:', e);
    }
}

function addRepoToList(repoName) {
    const repos = getReposList();
    if (!repos.find(r => r.name === repoName)) {
        repos.push({ name: repoName, createdAt: new Date().toISOString() });
        saveReposList(repos);
    }
}

function removeRepoFromList(repoName) {
    const repos = getReposList();
    const filtered = repos.filter(r => r.name !== repoName);
    saveReposList(filtered);
}

// List all repositories
export async function listRepositories() {
    try {
        const reposList = getReposList();
        
        // Load each repository from BrowserFS
        const loadPromises = reposList.map(async (repoInfo) => {
            try {
                const repo = await loadRepository(repoInfo.name);
                // Add createdAt from list
                repo.createdAt = repoInfo.createdAt;
                return repo;
            } catch (error) {
                console.error(`Error loading repository ${repoInfo.name}:`, error);
                return null;
            }
        });
        
        const repos = await Promise.all(loadPromises);
        return repos.filter(r => r !== null);
    } catch (error) {
        console.error('Error listing repositories:', error);
        return [];
    }
}

// Load a repository by name from BrowserFS
export async function loadRepository(repoName) {
    try {
        const { fs, path } = await initBrowserFS(repoName);
        const repoDir = '/';
        const repository = await loadRepositoryFromFS(fs, path, repoDir, repoName);
        return repository;
    } catch (error) {
        console.error('Error loading repository:', error);
        throw error;
    }
}

// Delete a repository
export async function deleteRepository(repoName) {
    try {
        // Remove from localStorage list first
        removeRepoFromList(repoName);
        
        // Delete the IndexedDB database used by BrowserFS for this repository
        // BrowserFS IndexedDB backend uses the store name as the database name
        const dbName = `git-repo-${repoName}`;
        
        // Note: BrowserFS doesn't provide a method to delete an entire filesystem.
        // We must use IndexedDB API directly. If the database is currently open,
        // we'll get a 'blocked' event, but the deletion will proceed once connections close.
        await new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            
            deleteRequest.onsuccess = () => {
                console.log(`Successfully deleted IndexedDB database: ${dbName}`);
                resolve();
            };
            
            deleteRequest.onerror = () => {
                console.error(`Error deleting IndexedDB database ${dbName}:`, deleteRequest.error);
                // Don't fail the entire operation - repo is already removed from list
                // The IndexedDB data will remain but won't be accessible
                resolve();
            };
            
            deleteRequest.onblocked = () => {
                // Database is currently open (e.g., repository is loaded)
                // The deletion will proceed automatically once all connections close
                console.warn(`IndexedDB database ${dbName} deletion blocked (connections open). Will delete when closed.`);
                resolve();
            };
        });
        
        return true;
    } catch (error) {
        console.error('Error deleting repository:', error);
        throw error;
    }
}

