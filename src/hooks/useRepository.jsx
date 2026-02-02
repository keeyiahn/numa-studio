import { useState, useEffect } from 'react';
import { initGitRepository, cloneGitRepository, updateGitRepository, gitRepositoryExists, repoNameExists, listRepositories, loadRepository, deleteRepository, hasPipelineFile, getFileTree, createGitHubRepo, addRemote, pushToGitHub, pullFromGitHub, storeGitHubToken, getGitHubToken, hasRemote, getRemoteUrl, extractTokenFromRemote } from '../utils/gitTools';

export default function useRepository() {
    const [repository, setRepository] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [gitCtx, setGitCtx] = useState(null);
    const [savedRepositories, setSavedRepositories] = useState([]);

    // Load list of saved repositories on mount
    useEffect(() => {
        refreshRepositoryList();
    }, []);

    // Note: Repository is now persisted to BrowserFS automatically via gitTools
    // No need for separate save operation - it's handled in updatePipeline, addScript, etc.

    const refreshRepositoryList = async () => {
        try {
            const repos = await listRepositories();
            setSavedRepositories(repos);
        } catch (error) {
            console.error('Failed to refresh repository list:', error);
        }
    };

    const initializeRepository = async (name) => {
        if (await repoNameExists(name)) {
            throw new Error('A repository with this name already exists.');
        }
        const newRepo = {
            name: name,
            pipeline: null,
            scripts: {},
            dockerfiles: {},
            manifests: {},
            createdAt: new Date().toISOString()
        };
        setRepository(newRepo);
        setIsInitialized(true);
        
        // Initialize git repository (new repository, so existingGit = false)
        // This will also persist to BrowserFS and add to registry
        let ctx = null;
        try {
            ctx = await initGitRepository(newRepo, false);
            setGitCtx(ctx);
        } catch (error) {
            console.error('Failed to initialize git repository:', error);
        }
        
        await refreshRepositoryList();
        
        // New repository has no pipeline file
        return { ...newRepo, hasPipelineFile: false };
    };

    const cloneRepository = async (name, gitUrl, keepConnected = true, token = null) => {
        if (await repoNameExists(name)) {
            throw new Error('A repository with this name already exists.');
        }
        const doClone = async (t) => {
            const ctx = await cloneGitRepository(name, gitUrl, keepConnected, t);
            if (keepConnected && typeof t === 'string' && t?.trim()) storeGitHubToken(name, t.trim());
            return ctx;
        };
        try {
            let ctx = await doClone(token);
            setGitCtx(ctx);

            // Load the cloned repository
            const loadedRepo = await loadRepository(name);
            setRepository(loadedRepo);
            setIsInitialized(true);
            
            // Check if any pipeline file exists in the cloned repository
            const hasPipeline = await hasPipelineFile(ctx);
            
            await refreshRepositoryList();
            
            return { ...loadedRepo, hasPipelineFile: hasPipeline, gitCtx: ctx };
        } catch (error) {
            if (error?.message?.includes('401')) {
                const t = window.prompt('Private repo. Enter GitHub token:');
                if (t?.trim()) return cloneRepository(name, gitUrl, keepConnected, t.trim());
            }
            console.error('Failed to clone repository:', error);
            throw error;
        }
    };

    const openRepository = async (name) => {
        try {
            // Load repository from BrowserFS
            const loadedRepo = await loadRepository(name);
            if (!loadedRepo) {
                throw new Error(`Repository "${name}" not found`);
            }
            
            setRepository(loadedRepo);
            setIsInitialized(true);
            
            // Check if Git repository already exists, then initialize/load it
            let ctx = null;
            try {
                const exists = await gitRepositoryExists(loadedRepo);
                ctx = await initGitRepository(loadedRepo, exists);
                setGitCtx(ctx);
            } catch (error) {
                console.error('Failed to load git repository:', error);
            }
            
            // Check if any pipeline file exists in the repository
            const hasPipeline = ctx ? await hasPipelineFile(ctx) : false;
            
            return { ...loadedRepo, hasPipelineFile: hasPipeline };
        } catch (error) {
            console.error('Failed to open repository:', error);
            throw error;
        }
    };

    const removeRepository = async (name) => {
        try {
            const isDeletingCurrent = repository?.name === name;
            // If deleting the currently open repo, clear it first so nothing holds a reference
            // to its IndexedDB store. Then deleteRepository can release the connection and delete.
            if (isDeletingCurrent) {
                clearRepository();
            }
            // Delete from BrowserFS (pass isDeletingCurrent so we release the store before delete)
            await deleteRepository(name, isDeletingCurrent);
            
            // Also delete templates for this repository
            try {
                const { deleteTemplatesForRepo } = await import('../utils/templateStorage');
                await deleteTemplatesForRepo(name);
            } catch (error) {
                console.warn('Failed to delete templates for repository:', error);
            }
            
            await refreshRepositoryList();
        } catch (error) {
            console.error('Failed to delete repository:', error);
            throw error;
        }
    };

    const clearRepository = () => {
        setRepository(null);
        setIsInitialized(false);
        setGitCtx(null);
    };

    const updatePipeline = async (pipeline, isNewPipeline = false, pipelinePath = 'pipeline.yaml', commitMessage = null) => {
        if (!repository) return;
        const updatedRepo = {
            ...repository,
            pipeline: pipeline,
            pipelinePath: pipelinePath // Store the path for this pipeline
        };
        setRepository(updatedRepo);
        
        // Update git repository
        try {
            // Use provided commit message, or generate default
            const message = commitMessage || (isNewPipeline 
                ? `Create ${pipelinePath}` 
                : `Update ${pipelinePath}`);
            const ctx = await updateGitRepository(gitCtx, updatedRepo, message, pipelinePath);
            setGitCtx(ctx);
        } catch (error) {
            console.error('Failed to commit pipeline changes:', error);
        }
    };

    const syncAllScripts = async (scripts) => {
        if (!repository) return;
        
        const syncedScripts = {};
        
        Object.entries(scripts || {}).forEach(([scriptName, scriptData]) => {
            syncedScripts[scriptName] = scriptData;
            // Don't store auto-generated dockerfiles - they'll be generated on the fly
        });
        
        const updatedRepo = {
            ...repository,
            scripts: syncedScripts
            // Don't update dockerfiles - they're auto-generated from scripts
        };
        
        setRepository(updatedRepo);
        
        // Update git repository
        try {
            const ctx = await updateGitRepository(gitCtx, updatedRepo, 'Update UDF scripts');
            setGitCtx(ctx);
        } catch (error) {
            console.error('Failed to commit script changes:', error);
        }
    };

    const addScript = async (scriptName, scriptData) => {
        if (!repository) return;
        const updatedRepo = {
            ...repository,
            scripts: {
                ...repository.scripts,
                [scriptName]: scriptData
            }
            // Don't store auto-generated dockerfiles - they'll be generated on the fly
        };
        setRepository(updatedRepo);
        
        // Update git repository
        try {
            const ctx = await updateGitRepository(gitCtx, updatedRepo, `Add UDF script: ${scriptName}`);
            setGitCtx(ctx);
        } catch (error) {
            console.error('Failed to commit script addition:', error);
        }
    };

    const removeScript = async (scriptName) => {
        if (!repository) return;
        const updatedRepo = {
            ...repository,
            scripts: (() => {
                const { [scriptName]: removed, ...remaining } = repository.scripts;
                return remaining;
            })(),
            dockerfiles: (() => {
                const { [scriptName]: removed, ...remaining } = repository.dockerfiles;
                return remaining;
            })()
        };
        setRepository(updatedRepo);
        
        // Update git repository
        try {
            const ctx = await updateGitRepository(gitCtx, updatedRepo, `Remove UDF script: ${scriptName}`);
            setGitCtx(ctx);
        } catch (error) {
            console.error('Failed to commit script removal:', error);
        }
    };

    const addDockerfile = (scriptName, dockerfileContent) => {
        if (!repository) return;
        setRepository(prev => ({
            ...prev,
            dockerfiles: {
                ...prev.dockerfiles,
                [scriptName]: dockerfileContent
            }
        }));
    };

    const addManifest = (manifestName, manifestContent) => {
        if (!repository) return;
        setRepository(prev => ({
            ...prev,
            manifests: {
                ...prev.manifests,
                [manifestName]: manifestContent
            }
        }));
    };

    const exportToGitHub = async (username, token, repoName, description = '', isPrivate = false) => {
        if (!repository || !gitCtx) {
            throw new Error('No repository initialized');
        }

        try {
            // Store token for future use
            storeGitHubToken(repository.name, token);

            // Check if remote already exists
            const remoteExists = await hasRemote(gitCtx, 'origin');
            
            let repoUrl;
            if (remoteExists) {
                // Get existing remote URL
                repoUrl = await getRemoteUrl(gitCtx, 'origin');
                if (!repoUrl) {
                    throw new Error('Remote exists but URL not found');
                }
            } else {
                // Create new GitHub repository
                const repoData = await createGitHubRepo(username, token, repoName, description, isPrivate);
                repoUrl = repoData.cloneUrl;
                
                // Add remote
                await addRemote(gitCtx, 'origin', repoUrl);
            }

            // Ensure all changes are committed
            await updateGitRepository(gitCtx, repository, 'Update repository before push');

            // Push to GitHub
            await pushToGitHub(gitCtx, token, 'origin', 'main');

            return {
                url: repoUrl.replace('.git', ''),
                success: true
            };
        } catch (error) {
            console.error('Failed to export to GitHub:', error);
            throw error;
        }
    };

    const pushToGitHubRemote = async () => {
        if (!repository || !gitCtx) {
            throw new Error('No repository initialized');
        }

        try {
            // Check if remote exists
            const remoteExists = await hasRemote(gitCtx, 'origin');
            if (!remoteExists) {
                throw new Error('Repository not connected to GitHub. Please export first.');
            }

            // Try to get stored token
            let token = getGitHubToken(repository.name);
            
            // If not found, try to extract from remote URL
            if (!token) {
                token = await extractTokenFromRemote(gitCtx, 'origin');
                if (token) {
                    // Store it for future use
                    storeGitHubToken(repository.name, token);
                }
            }
            
            if (!token) {
                throw new Error('GitHub token not found. Please export again with your token.');
            }

            // Ensure all changes are committed
            await updateGitRepository(gitCtx, repository, 'Update repository');

            // Push to GitHub
            await pushToGitHub(gitCtx, token, 'origin', 'main');

            return { success: true };
        } catch (error) {
            console.error('Failed to push to GitHub:', error);
            throw error;
        }
    };

    const pullFromGitHubRemote = async () => {
        if (!repository || !gitCtx) {
            throw new Error('No repository initialized');
        }

        try {
            // Check if remote exists
            const remoteExists = await hasRemote(gitCtx, 'origin');
            if (!remoteExists) {
                throw new Error('Repository not connected to GitHub. Cannot pull without a remote.');
            }

            // Try to get stored token
            let token = getGitHubToken(repository.name);
            
            // If not found, try to extract from remote URL
            if (!token) {
                token = await extractTokenFromRemote(gitCtx, 'origin');
                if (token) {
                    // Store it for future use
                    storeGitHubToken(repository.name, token);
                }
            }
            
            if (!token) {
                throw new Error('GitHub token not found. Please export again with your token.');
            }

            // Pull from GitHub
            await pullFromGitHub(gitCtx, token, 'origin', 'main');

            // Reload repository to reflect pulled changes
            const loadedRepo = await loadRepository(repository.name);
            setRepository(loadedRepo);

            return { success: true };
        } catch (error) {
            console.error('Failed to pull from GitHub:', error);
            throw error;
        }
    };

    const loadFileTree = async () => {
        if (!gitCtx) return [];
        const { fs, path: pathMod, dir } = gitCtx;
        return getFileTree(fs, pathMod, dir);
    };

    return {
        repository,
        gitCtx,
        isInitialized,
        savedRepositories,
        initializeRepository,
        cloneRepository,
        openRepository,
        removeRepository,
        clearRepository,
        updatePipeline,
        loadFileTree,
        syncAllScripts,
        addScript,
        removeScript,
        addDockerfile,
        addManifest,
        exportToGitHub,
        pushToGitHubRemote,
        pullFromGitHubRemote
    };
}

