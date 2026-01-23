import { useState, useEffect } from 'react';
import { initGitRepository, cloneGitRepository, updateGitRepository, gitRepositoryExists, listRepositories, loadRepository, deleteRepository } from '../utils/gitTools';

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
        try {
            const ctx = await initGitRepository(newRepo, false);
            setGitCtx(ctx);
        } catch (error) {
            console.error('Failed to initialize git repository:', error);
        }
        
        await refreshRepositoryList();
        
        return newRepo;
    };

    const cloneRepository = async (name, gitUrl) => {
        // Clone repository from GitHub
        try {
            const ctx = await cloneGitRepository(name, gitUrl);
            setGitCtx(ctx);
            
            // Load the cloned repository
            const loadedRepo = await loadRepository(name);
            setRepository(loadedRepo);
            setIsInitialized(true);
            
            await refreshRepositoryList();
            
            return loadedRepo;
        } catch (error) {
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
            try {
                const exists = await gitRepositoryExists(loadedRepo);
                const ctx = await initGitRepository(loadedRepo, exists);
                setGitCtx(ctx);
            } catch (error) {
                console.error('Failed to load git repository:', error);
            }
            
            return loadedRepo;
        } catch (error) {
            console.error('Failed to open repository:', error);
            throw error;
        }
    };

    const removeRepository = async (name) => {
        try {
            // Delete from BrowserFS registry (this also deletes the IndexedDB store)
            await deleteRepository(name);
            
            // Also delete templates for this repository
            try {
                const { deleteTemplatesForRepo } = await import('../utils/templateStorage');
                await deleteTemplatesForRepo(name);
            } catch (error) {
                console.warn('Failed to delete templates for repository:', error);
                // Don't fail the entire operation if template deletion fails
            }
            
            await refreshRepositoryList();
            // If the current repository is being deleted, clear it
            if (repository?.name === name) {
                clearRepository();
            }
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

    const updatePipeline = async (pipeline) => {
        if (!repository) return;
        const updatedRepo = {
            ...repository,
            pipeline: pipeline
        };
        setRepository(updatedRepo);
        
        // Update git repository
        try {
            const ctx = await updateGitRepository(gitCtx, updatedRepo, 'Update pipeline.yaml');
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
        syncAllScripts,
        addScript,
        removeScript,
        addDockerfile,
        addManifest
    };
}

