import { useState, useEffect } from 'react';
import { generateDockerfile } from '../utils/repositoryTools';
import { initGitRepository, updateGitRepository } from '../utils/gitTools';
import { saveRepository, listRepositories, loadRepository, deleteRepository } from '../utils/repositoryStorage';

export default function useRepository() {
    const [repository, setRepository] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [gitFS, setGitFS] = useState(null);
    const [savedRepositories, setSavedRepositories] = useState([]);

    // Load list of saved repositories on mount
    useEffect(() => {
        refreshRepositoryList();
    }, []);

    // Save repository to IndexedDB whenever it changes
    useEffect(() => {
        if (repository && isInitialized) {
            saveRepository(repository).catch(err => {
                console.error('Failed to save repository:', err);
            });
            refreshRepositoryList();
        }
    }, [repository, isInitialized]);

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
        
        // Initialize git repository
        try {
            const fs = await initGitRepository(newRepo);
            setGitFS(fs);
        } catch (error) {
            console.error('Failed to initialize git repository:', error);
        }
        
        // Save to IndexedDB
        await saveRepository(newRepo);
        await refreshRepositoryList();
        
        return newRepo;
    };

    const openRepository = async (name) => {
        try {
            const loadedRepo = await loadRepository(name);
            if (!loadedRepo) {
                throw new Error(`Repository "${name}" not found`);
            }
            
            setRepository(loadedRepo);
            setIsInitialized(true);
            
            // Initialize git repository from loaded repo
            try {
                const fs = await initGitRepository(loadedRepo);
                setGitFS(fs);
            } catch (error) {
                console.error('Failed to initialize git repository:', error);
            }
            
            return loadedRepo;
        } catch (error) {
            console.error('Failed to open repository:', error);
            throw error;
        }
    };

    const removeRepository = async (name) => {
        try {
            await deleteRepository(name);
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
        setGitFS(null);
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
            const fs = await updateGitRepository(gitFS, updatedRepo, 'Update pipeline.yaml');
            setGitFS(fs);
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
            const fs = await updateGitRepository(gitFS, updatedRepo, 'Update UDF scripts');
            setGitFS(fs);
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
            const fs = await updateGitRepository(gitFS, updatedRepo, `Add UDF script: ${scriptName}`);
            setGitFS(fs);
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
            const fs = await updateGitRepository(gitFS, updatedRepo, `Remove UDF script: ${scriptName}`);
            setGitFS(fs);
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
        isInitialized,
        savedRepositories,
        initializeRepository,
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

