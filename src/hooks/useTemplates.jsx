import { useState, useEffect, useRef } from 'react';
import { saveTemplatesForRepo, loadTemplatesForRepo } from '../utils/templateStorage';

// Default templates that are available when no repository is open
const defaultTemplates = {
    "generator-source": {
        id: "generator-source",
        type: "input",
        data: { 
            label: "generator-source",
            config: {
                scale: { min: 1 },
                source: { generator: {} }
            }
     },
    },
    "cat-udf": {
        id: "cat-udf",
        type: "default",
        data: { 
            label: "cat-udf",
            config: {
                scale: { min: 1 },
                udf: { builtin: { name: "cat" } },
            }
        },
    },
    "log-sink": {
        id: "log-sink",
        type: "output",
        data: { 
            label: "log-sink",
            config: {
                scale: { min: 1 },
                sink: { log: {} },
            }
        },
    },
};

export default function useTemplates(repositoryHook = null) {
    const [templates, setTemplates] = useState(defaultTemplates);
    const currentRepoNameRef = useRef(null);
    const isInitializingRef = useRef(false);

    // Get current repository name
    const currentRepoName = repositoryHook?.repository?.name || null;
    const isInitialized = repositoryHook?.isInitialized || false;
    const templatesRef = useRef(templates);

    // Keep ref in sync with templates state
    useEffect(() => {
        templatesRef.current = templates;
    }, [templates]);

    // Load templates when repository changes
    useEffect(() => {
        // Skip if we're already initializing or if repo name hasn't changed
        if (isInitializingRef.current || currentRepoNameRef.current === currentRepoName) {
            return;
        }

        const loadTemplates = async () => {
            isInitializingRef.current = true;

            // Save current templates before switching (if we had a previous repo)
            if (currentRepoNameRef.current) {
                try {
                    // Use ref to get current templates (avoid stale closure)
                    await saveTemplatesForRepo(currentRepoNameRef.current, templatesRef.current);
                } catch (error) {
                    console.error('Error saving templates before switch:', error);
                }
            }

            // Update ref to new repo name
            currentRepoNameRef.current = currentRepoName;

            // Load templates for new repository (or use defaults if no repo)
            if (currentRepoName && isInitialized) {
                try {
                    const loadedTemplates = await loadTemplatesForRepo(currentRepoName);
                    if (loadedTemplates) {
                        setTemplates(loadedTemplates);
                    } else {
                        // No saved templates for this repo, start with defaults
                        setTemplates(defaultTemplates);
                    }
                } catch (error) {
                    console.error('Error loading templates:', error);
                    setTemplates(defaultTemplates);
                }
            } else {
                // No repository open, use default templates
                setTemplates(defaultTemplates);
                currentRepoNameRef.current = null;
            }

            isInitializingRef.current = false;
        };

        loadTemplates();
    }, [currentRepoName, isInitialized]);

    // Save templates whenever they change (debounced)
    useEffect(() => {
        // Don't save during initialization or if no repo is open
        if (isInitializingRef.current || !currentRepoName || !isInitialized) {
            return;
        }

        // Debounce saves to avoid too many IndexedDB writes
        const timeoutId = setTimeout(async () => {
            try {
                await saveTemplatesForRepo(currentRepoName, templates);
            } catch (error) {
                console.error('Error auto-saving templates:', error);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [templates, currentRepoName, isInitialized]);

    const addTemplate = async (template) => {
        setTemplates((prevTemplates) => ({
            ...prevTemplates,
            [template.id]: template
        }));
        // Auto-save is handled by useEffect above
    };

    const editTemplate = async (templateId, newId, newConfig) => {
        setTemplates((prev) => {
          const template = prev[templateId];
          if (!template) return prev;
      
          const updatedTemplate = {
            ...template,
            id: newId,                        // update the template's id field
            data: {
              ...template.data,
              config: newConfig,              // update config
              label: newId,                   // optional: sync label to new ID
            },
          };
      
          // Rebuild object with new key
          const { [templateId]: _, ...rest } = prev;
      
          return {
            ...rest,
            [newId]: updatedTemplate,         // new key with updated template
          };
        });
        // Auto-save is handled by useEffect above
    };

    const removeTemplate = async (templateId) => {
        setTemplates((prev) => {
            const { [templateId]: _, ...rest } = prev;
            return rest;
        });
        // Auto-save is handled by useEffect above
    };

    const setAllTemplates = (newTemplates) => {
        setTemplates(newTemplates || defaultTemplates);
        // Auto-save is handled by useEffect above
    };

    return {
        templates,
        addTemplate,
        editTemplate,
        removeTemplate,
        setAllTemplates
    };
}