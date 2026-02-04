import * as git from 'isomorphic-git';
import * as http from 'isomorphic-git/http/web';
import * as BrowserFSRaw from 'browserfs';

// BrowserFS can export as default or namespace depending on bundler; normalize here
const BrowserFS = BrowserFSRaw.default || BrowserFSRaw;

// Single IndexedDB store for all repos; each repo lives under /${repoName}/
const REPOS_STORE_NAME = 'repos';

let browserFSInitPromise = null;

// Ensure BrowserFS is initialized once with the single repos store. All repo operations use
// the same FS and path convention: repo root = /${repoName}/
async function ensureBrowserFS() {
    if (browserFSInitPromise) return browserFSInitPromise;
    browserFSInitPromise = new Promise((resolve, reject) => {
        const fsModule = BrowserFS.BFSRequire('fs');
        if (fsModule.getRootFS()) {
            // Already configured (e.g. by a previous call that raced)
            const path = BrowserFS.BFSRequire('path');
            if (typeof globalThis.Buffer === 'undefined') {
                globalThis.Buffer = BrowserFS.BFSRequire('buffer').Buffer;
            }
            return resolve({ fs: fsModule, path });
        }
        BrowserFS.configure({
            fs: 'IndexedDB',
            options: { storeName: REPOS_STORE_NAME }
        }, (e) => {
            if (e) {
                browserFSInitPromise = null;
                return reject(e);
            }
            const fs = BrowserFS.BFSRequire('fs');
            const path = BrowserFS.BFSRequire('path');
            if (typeof globalThis.Buffer === 'undefined') {
                globalThis.Buffer = BrowserFS.BFSRequire('buffer').Buffer;
            }
            resolve({ fs, path });
        });
    });
    return browserFSInitPromise;
}

// Repo root path for a given repo name (single FS, path-based namespacing)
function getRepoDir(pathMod, repoName) {
    return pathMod.join('/', repoName);
}

// Promise wrappers around BrowserFS (callback-style) APIs
const pStat = (fs, p) => new Promise((res, rej) => fs.stat(p, (err, stat) => err ? rej(err) : res(stat)));
const pMkdir = (fs, p) => new Promise((res, rej) => fs.mkdir(p, { recursive: true }, (err) => err ? rej(err) : res()));
const pReaddir = (fs, p) => new Promise((res, rej) => fs.readdir(p, (err, files) => err ? rej(err) : res(files)));
const pWriteFile = (fs, p, data) => new Promise((res, rej) => fs.writeFile(p, data, (err) => err ? rej(err) : res()));
const pReadFile = (fs, p) => new Promise((res, rej) => fs.readFile(p, (err, data) => err ? rej(err) : res(data)));
const pUnlink = (fs, p) => new Promise((res, rej) => fs.unlink(p, (err) => (err ? rej(err) : res())));
const pRmdir = (fs, p) => new Promise((res, rej) => fs.rmdir(p, (err) => (err ? rej(err) : res())));

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

async function syncRepositoryFiles(fs, pathMod, repoDir, repository, createRequirementsTxt = false, pipelinePath = 'pipeline.yaml') {
    if (!repository) return;

    // Note: We don't store repo-metadata.json anymore - metadata is tracked in git config and registry
    // The repository name and timestamps are available from git commits and the registry

    // pipeline file (use provided path or default to pipeline.yaml)
    if (repository.pipeline) {
        const pathToUse = repository.pipelinePath || pipelinePath;
        await writeFileEnsuringDir(fs, pathMod, pathMod.join(repoDir, pathToUse), repository.pipeline);
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

/**
 * Build a tree of files and folders for the repository (relative paths).
 * Used for directory picker in Save Pipeline As.
 * @returns {Promise<Array<{ name: string, type: 'folder'|'file', path: string, children?: Array }>>}
 */
export async function getFileTree(fs, pathMod, repoDir) {
    async function readDir(dirPath, parentPath = '') {
        const items = [];
        let entries = [];
        try {
            entries = await pReaddir(fs, pathMod.join(repoDir, dirPath));
        } catch (e) {
            return items;
        }
        for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            const fullPath = pathMod.join(repoDir, dirPath, entry);
            const relativePath = parentPath ? `${parentPath}/${entry}` : entry;
            try {
                const stat = await pStat(fs, fullPath);
                if (stat.isDirectory()) {
                    const children = await readDir(pathMod.join(dirPath, entry), relativePath);
                    items.push({ name: entry, type: 'folder', path: relativePath, children });
                } else {
                    items.push({ name: entry, type: 'file', path: relativePath });
                }
            } catch (e) {
                // skip
            }
        }
        return items;
    }
    return readDir('');
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

// Check if any file in the repository contains a Numaflow pipeline structure
export async function hasPipelineFile(gitCtx) {
    if (!gitCtx) return false;
    
    const { fs, path, dir } = gitCtx;
    
    try {
        const allFiles = await getAllFiles(fs, path, dir);
        
        // Check YAML files for pipeline structure
        for (const filePath of allFiles) {
            if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
                continue;
            }
            
            try {
                const content = await pReadFile(fs, filePath);
                const contentStr = content.toString();
                
                // Quick check for pipeline markers
                if (contentStr.includes('apiVersion:') && 
                    contentStr.includes('numaflow.numaproj.io/v1alpha1') &&
                    contentStr.includes('kind:') &&
                    contentStr.includes('Pipeline')) {
                    return true;
                }
            } catch (e) {
                // Skip files that can't be read
                continue;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error checking for pipeline files:', error);
        return false;
    }
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
export async function cloneGitRepository(repoName, gitUrl, keepConnected = true, token = null) {
    const { fs, path } = await ensureBrowserFS();
    const repoDir = getRepoDir(path, repoName);

    await ensureDir(fs, path, repoDir);

    try {
        // Add to simple localStorage list
        addRepoToList(repoName);

        // Local CORS proxy for development (remove in production)
        // Replace github.com with localhost:3001 to use local proxy
        const LOCAL_PROXY = 'http://localhost:3001';
        const proxiedUrl = gitUrl.replace('https://github.com', LOCAL_PROXY);

        // Clone the repository (this will create remote 'origin' pointing to proxiedUrl)
        const trimmedToken = typeof token === 'string' ? token.trim() : '';
        const authOptions = trimmedToken
            ? {
                  onAuth: () => ({
                      username: trimmedToken,
                      password: '' // GitHub accepts token as username with empty password
                  }),
                  onAuthFailure: () => {
                      throw new Error('Authentication failed. Please check your token.');
                  }
              }
            : {};

        await git.clone({
            fs,
            http,
            dir: repoDir,
            url: proxiedUrl,
            singleBranch: true,
            ...authOptions
        });

        if (keepConnected) {
            // After cloning, update the remote URL to point to the real GitHub URL
            // (not the proxy URL) so future operations work correctly
            await git.addRemote({
                fs,
                dir: repoDir,
                remote: 'origin',
                url: gitUrl, // Use original GitHub URL, not proxy
                force: true // Overwrite the proxy URL that was set during clone
            });
        } else {
            // Remove the remote connection - treat as a new local repo
            await git.deleteRemote({
                fs,
                dir: repoDir,
                remote: 'origin'
            });
        }

        // Set git config (user.name and user.email) for future operations
        await ensureGitConfig({ fs, path, dir: repoDir });

        return { fs, path, dir: repoDir };
    } catch (error) {
        console.error('Error cloning git repository:', error);
        throw error;
    }
}

// Initialize git repository (per repo directory under /)
export async function initGitRepository(repository, existingGit = false) {
    const { fs, path } = await ensureBrowserFS();
    const repoDir = getRepoDir(path, repository.name);

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

            // Set git config (user.name and user.email) for future operations
            await ensureGitConfig({ fs, path, dir: repoDir });

            // Create initial commit
            await addAndCommit({ fs, path, dir: repoDir }, 'Initial commit');
        } else {
            // Git already exists, just sync repository files (don't create requirements.txt)
            await syncRepositoryFiles(fs, path, repoDir, repository, false);
            
            // Ensure git config is set even for existing repos
            await ensureGitConfig({ fs, path, dir: repoDir });
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
        // Ensure git config is set (needed for commits)
        await ensureGitConfig(gitCtx);
        
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

// Save script and Dockerfile to a chosen directory path in the repo
export async function saveScriptToPath(gitCtx, scriptName, scriptData, directoryPath = '') {
    if (!gitCtx) throw new Error('No git context');
    const { fs, path: pathMod, dir } = gitCtx;
    const sanitizedName = (scriptName || '').replace(/[^a-zA-Z0-9-_]/g, '_') || 'script';
    const scriptContent = typeof scriptData === 'string' ? scriptData : (scriptData?.data ?? scriptData ?? '');
    const dockerfileContent = `FROM python:3.10-slim
WORKDIR /app
COPY . /app
RUN pip install -r requirements.txt
CMD ["python", "-u", "${sanitizedName}.py"]`;

    const baseDir = directoryPath && directoryPath !== '.' ? pathMod.join(dir, directoryPath) : dir;
    const scriptFullPath = pathMod.join(baseDir, `${sanitizedName}.py`);
    const dockerfileFullPath = pathMod.join(baseDir, `Dockerfile.${sanitizedName}`);

    await writeFileEnsuringDir(fs, pathMod, scriptFullPath, scriptContent);
    await writeFileEnsuringDir(fs, pathMod, dockerfileFullPath, dockerfileContent);

    await addAndCommit(gitCtx, `Add script: ${sanitizedName}.py and Dockerfile.${sanitizedName}`);
    return gitCtx;
}

// Update git repository with new repository state
export async function updateGitRepository(gitCtx, repository, commitMessage = 'Update repository', pipelinePath = 'pipeline.yaml') {
    if (!gitCtx) {
        // Initialize if not already initialized
        gitCtx = await initGitRepository(repository, false);
    }

    const { fs, path, dir } = gitCtx;

    // Sync filesystem with current repository state (don't create requirements.txt on updates)
    await syncRepositoryFiles(fs, path, dir, repository, false, pipelinePath);

    // Add and commit changes
    await addAndCommit({ fs, path, dir }, commitMessage);

    return gitCtx;
}

// Set git user config (name and email) if not already set
export async function ensureGitConfig(gitCtx) {
    const { fs, dir } = gitCtx;
    try {
        // Check if user.name is already set
        let userName;
        try {
            userName = await git.getConfig({ fs, dir, path: 'user.name' });
        } catch (e) {
            // user.name not set, will set it below
            userName = null;
        }

        // Set user.name if not set or empty
        if (!userName || userName.trim() === '') {
            await git.setConfig({
                fs,
                dir,
                path: 'user.name',
                value: 'Numaflow GUI'
            });
            // Verify it was set
            userName = await git.getConfig({ fs, dir, path: 'user.name' });
            if (!userName || userName.trim() === '') {
                throw new Error('Failed to set user.name');
            }
        }

        // Check if user.email is already set
        let userEmail;
        try {
            userEmail = await git.getConfig({ fs, dir, path: 'user.email' });
        } catch (e) {
            // user.email not set, will set it below
            userEmail = null;
        }

        // Set user.email if not set or empty
        if (!userEmail || userEmail.trim() === '') {
            await git.setConfig({
                fs,
                dir,
                path: 'user.email',
                value: 'gui@numaflow.local'
            });
            // Verify it was set
            userEmail = await git.getConfig({ fs, dir, path: 'user.email' });
            if (!userEmail || userEmail.trim() === '') {
                throw new Error('Failed to set user.email');
            }
        }
    } catch (error) {
        console.error('Error setting git config:', error);
        // Re-throw the error so callers know it failed
        throw new Error(`Failed to ensure git config: ${error.message}`);
    }
}

// Check if a repository with the given name already exists (dir or in registry)
export async function repoNameExists(repoName) {
    if (!repoName || typeof repoName !== 'string' || !repoName.trim()) return false;
    const name = repoName.trim();
    try {
        const reposList = getReposList();
        if (reposList.some(r => r.name === name)) return true;
        const { fs, path } = await ensureBrowserFS();
        const repoDir = getRepoDir(path, name);
        try {
            const stat = await pStat(fs, repoDir);
            return stat.isDirectory();
        } catch {
            return false;
        }
    } catch {
        return false;
    }
}

// Check if Git repository already exists
export async function gitRepositoryExists(repository) {
    try {
        const { fs, path } = await ensureBrowserFS();
        const repoDir = getRepoDir(path, repository.name);
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
        const { fs, path } = await ensureBrowserFS();
        const repoDir = getRepoDir(path, repoName);
        const repository = await loadRepositoryFromFS(fs, path, repoDir, repoName);
        return repository;
    } catch (error) {
        console.error('Error loading repository:', error);
        throw error;
    }
}

// Recursively remove a directory and all its contents (for repo deletion)
async function removeRecursive(fs, pathMod, dirPath) {
    let entries = [];
    try {
        entries = await pReaddir(fs, dirPath);
    } catch (e) {
        return; // dir doesn't exist or not a directory
    }
    for (const entry of entries) {
        const fullPath = pathMod.join(dirPath, entry);
        try {
            const stat = await pStat(fs, fullPath);
            if (stat.isDirectory()) {
                await removeRecursive(fs, pathMod, fullPath);
                await pRmdir(fs, fullPath);
            } else {
                await pUnlink(fs, fullPath);
            }
        } catch (e) {
            console.warn(`Could not remove ${fullPath}:`, e);
        }
    }
}

// Delete a repository (remove its directory tree from the single store)
export async function deleteRepository(repoName, _isDeletingCurrentRepo = false) {
    try {
        const { fs, path } = await ensureBrowserFS();
        const repoDir = getRepoDir(path, repoName);
        await removeRecursive(fs, path, repoDir);
        try {
            await pRmdir(fs, repoDir);
        } catch (e) {
            // repoDir might not exist if repo was never created
        }
        removeRepoFromList(repoName);
        return true;
    } catch (error) {
        console.error('Error deleting repository:', error);
        throw error;
    }
}

// Token storage utilities
const TOKEN_STORAGE_PREFIX = 'github-token-';

export function storeGitHubToken(repoName, token) {
    try {
        localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${repoName}`, token);
    } catch (error) {
        console.error('Error storing GitHub token:', error);
    }
}

export function getGitHubToken(repoName) {
    try {
        const token = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${repoName}`);
        if (token) {
            return token;
        }
        // Try to find token from any repo (in case repo name changed)
        // This is a fallback - check all localStorage keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(TOKEN_STORAGE_PREFIX)) {
                const storedToken = localStorage.getItem(key);
                if (storedToken) {
                    // Store it under current repo name for future use
                    localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${repoName}`, storedToken);
                    return storedToken;
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error retrieving GitHub token:', error);
        return null;
    }
}

// Try to extract token from remote URL (if it was embedded)
export async function extractTokenFromRemote(gitCtx, remoteName = 'origin') {
    try {
        const url = await getRemoteUrl(gitCtx, remoteName);
        if (!url) return null;
        
        // Check if URL has embedded token: https://token@github.com/...
        const match = url.match(/https:\/\/([^@]+)@github\.com/);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Create GitHub repository via API
export async function createGitHubRepo(username, token, repoName, description = '', isPrivate = false) {
    try {
        const response = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: repoName,
                description: description,
                private: isPrivate,
                auto_init: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(errorData.message || `Failed to create repository: ${response.statusText}`);
        }

        const repoData = await response.json();
        return {
            url: repoData.html_url,
            cloneUrl: repoData.clone_url,
            sshUrl: repoData.ssh_url
        };
    } catch (error) {
        console.error('Error creating GitHub repository:', error);
        throw error;
    }
}

// Add remote to git repository
export async function addRemote(gitCtx, remoteName, remoteUrl) {
    const { fs, dir } = gitCtx;
    try {
        await git.addRemote({
            fs,
            dir,
            remote: remoteName,
            url: remoteUrl
        });
        return true;
    } catch (error) {
        // If remote already exists, update it with force
        if (error.message && error.message.includes('already exists')) {
            await git.addRemote({
                fs,
                dir,
                remote: remoteName,
                url: remoteUrl,
                force: true
            });
            return true;
        }
        console.error('Error adding remote:', error);
        throw error;
    }
}

// Push to GitHub
export async function pushToGitHub(gitCtx, token, remoteName = 'origin', branch = 'main') {
    const { fs, dir } = gitCtx;
    
    try {
        // Ensure git config is set (needed for commits)
        await ensureGitConfig(gitCtx);
        
        // Ensure we have the latest commits
        await addAndCommit(gitCtx, 'Update repository');
        
        // Get the remote URL
        const remotes = await git.listRemotes({ fs, dir });
        const remote = remotes.find(r => r.remote === remoteName);
        if (!remote) {
            throw new Error(`Remote ${remoteName} not found`);
        }
        
        // Store original URL for restoration
        const originalUrl = remote.url;
        
        // Clean URL (remove any existing auth)
        let cleanUrl = originalUrl;
        if (cleanUrl.startsWith('https://')) {
            // Remove existing auth if present
            cleanUrl = cleanUrl.replace(/https:\/\/[^@]+@/, 'https://');
        }
        
        // Use local CORS proxy for development (same as clone)
        // Replace github.com with localhost:3001 to use local proxy
        const LOCAL_PROXY = 'http://localhost:3001';
        const proxiedUrl = cleanUrl.replace('https://github.com', LOCAL_PROXY);
        
        // Temporarily update remote URL to use proxy
        await git.addRemote({
            fs,
            dir,
            remote: remoteName,
            url: proxiedUrl,
            force: true
        });
        
        try {
            // Push with onAuth callback for proper authentication
            // GitHub PAT format: username=token, password='' or 'x-oauth-basic'
            await git.push({
                fs,
                http,
                dir,
                remote: remoteName,
                ref: branch,
                onAuth: () => ({
                    username: token,
                    password: '' // GitHub accepts token as username with empty password
                }),
                onAuthFailure: () => {
                    throw new Error('Authentication failed. Please check your token.');
                }
            });
        } finally {
            // Restore original URL
            await git.addRemote({
                fs,
                dir,
                remote: remoteName,
                url: originalUrl,
                force: true
            });
        }
        
        return true;
    } catch (error) {
        console.error('Error pushing to GitHub:', error);
        throw error;
    }
}

// Pull from GitHub
export async function pullFromGitHub(gitCtx, token, remoteName = 'origin', branch = 'main') {
    const { fs, dir } = gitCtx;
    
    try {
        // Ensure git config is set (needed for merge commits)
        await ensureGitConfig(gitCtx);
        
        // Check if remote exists
        const remotes = await git.listRemotes({ fs, dir });
        const remote = remotes.find(r => r.remote === remoteName);
        if (!remote) {
            throw new Error(`Remote ${remoteName} not found`);
        }
        
        // Store original URL for restoration
        const originalUrl = remote.url;
        
        // Clean URL (remove any existing auth)
        let cleanUrl = originalUrl;
        if (cleanUrl.startsWith('https://')) {
            // Remove existing auth if present
            cleanUrl = cleanUrl.replace(/https:\/\/[^@]+@/, 'https://');
        }
        
        // Use local CORS proxy for development (same as clone and push)
        // Replace github.com with localhost:3001 to use local proxy
        const LOCAL_PROXY = 'http://localhost:3001';
        const proxiedUrl = cleanUrl.replace('https://github.com', LOCAL_PROXY);
        
        // Temporarily update remote URL to use proxy
        await git.addRemote({
            fs,
            dir,
            remote: remoteName,
            url: proxiedUrl,
            force: true
        });
        
        try {
            // Get author info from config (or use defaults)
            let authorName, authorEmail;
            try {
                authorName = await git.getConfig({ fs, dir, path: 'user.name' });
                authorEmail = await git.getConfig({ fs, dir, path: 'user.email' });
            } catch (e) {
                // Fallback to defaults if config not found
                authorName = 'Numaflow GUI';
                authorEmail = 'gui@numaflow.local';
            }

            // Pull with onAuth callback for proper authentication
            // GitHub PAT format: username=token, password='' or 'x-oauth-basic'
            // Pass author info directly for merge commits
            await git.pull({
                fs,
                http,
                dir,
                remote: remoteName,
                ref: branch,
                singleBranch: true,
                author: {
                    name: authorName || 'Numaflow GUI',
                    email: authorEmail || 'gui@numaflow.local'
                },
                onAuth: () => ({
                    username: token,
                    password: '' // GitHub accepts token as username with empty password
                }),
                onAuthFailure: () => {
                    throw new Error('Authentication failed. Please check your token.');
                }
            });
        } finally {
            // Restore original URL
            await git.addRemote({
                fs,
                dir,
                remote: remoteName,
                url: originalUrl,
                force: true
            });
        }
        
        return true;
    } catch (error) {
        console.error('Error pulling from GitHub:', error);
        throw error;
    }
}

// Check if remote exists
export async function hasRemote(gitCtx, remoteName = 'origin') {
    const { fs, dir } = gitCtx;
    try {
        const remotes = await git.listRemotes({ fs, dir });
        return remotes.some(remote => remote.remote === remoteName);
    } catch (error) {
        return false;
    }
}

// Get remote URL
export async function getRemoteUrl(gitCtx, remoteName = 'origin') {
    const { fs, dir } = gitCtx;
    try {
        const remotes = await git.listRemotes({ fs, dir });
        const remote = remotes.find(r => r.remote === remoteName);
        return remote ? remote.url : null;
    } catch (error) {
        return null;
    }
}

// Remove remote from git repository
export async function removeRemote(gitCtx, remoteName = 'origin') {
    const { fs, dir } = gitCtx;
    try {
        await git.deleteRemote({
            fs,
            dir,
            remote: remoteName
        });
        return true;
    } catch (error) {
        console.error('Error removing remote:', error);
        throw error;
    }
}

