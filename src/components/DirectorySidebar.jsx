import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronLeft, ChevronRight, ChevronDown, Plus, FolderOpen, FileCode, Trash2, Upload, Download, Github } from 'lucide-react';
import { sidebarStyles, buttonStyles, modalStyles, inputStyles, fileTreeStyles, emptyStateStyles } from '../styles/components';
import { hoverHandlers } from '../styles/hoverUtils';
import { colors, spacing, borderRadius, shadows, typography } from '../styles/theme';

const DirectorySidebar = ({ repositoryHook, isVisible = true, onToggle, modalHook, scriptsHook, pipelineHook }) => {
    const { repository, isInitialized, savedRepositories, initializeRepository, cloneRepository, openRepository, removeRepository, clearRepository, gitCtx, fileTreeVersion, exportToGitHub, pushToGitHubRemote, pullFromGitHubRemote } = repositoryHook;
    const { openModal } = modalHook || {};
    const { setAllScripts } = scriptsHook || {};
    const [showInitModal, setShowInitModal] = useState(false);
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloneModal, setShowCloneModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [repoName, setRepoName] = useState('');
    const [gitUrl, setGitUrl] = useState('');
    const [keepConnected, setKeepConnected] = useState(false);
    const [cloneToken, setCloneToken] = useState('');
    const [fileTree, setFileTree] = useState(null);
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [githubUsername, setGithubUsername] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [githubRepoName, setGithubRepoName] = useState('');
    const [githubDescription, setGithubDescription] = useState('');
    const [githubIsPrivate, setGithubIsPrivate] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [hasGitHubRemote, setHasGitHubRemote] = useState(false);
    const [remoteRepoInfo, setRemoteRepoInfo] = useState(null); // { username, repo, fullUrl }
    const [showPushTokenModal, setShowPushTokenModal] = useState(false);
    const [pushToken, setPushToken] = useState('');

    const handleInitialize = async () => {
        if (repoName.trim()) {
            try {
                const newRepo = await initializeRepository(repoName.trim());
                setRepoName('');
                setShowInitModal(false);

                // Auto-load empty pipeline template for new repository
                if (!newRepo.hasPipelineFile && pipelineHook) {
                    const { setNodes, setEdges, markPipelineLoaded } = pipelineHook;
                    if (setNodes && setEdges) {
                        const { getEmptyPipelineTemplate, importYamlFromString } = await import('../utils/yamlTools');
                        const emptyTemplate = getEmptyPipelineTemplate();
                        importYamlFromString(emptyTemplate, setNodes, setEdges);
                        if (markPipelineLoaded) {
                            markPipelineLoaded(null);
                        }
                    }
                }
            } catch (error) {
                alert('Failed to initialize repository: ' + error.message);
            }
        }
    };

    const handleClone = async () => {
        if (repoName.trim() && gitUrl.trim()) {
            try {
                const clonedRepo = await cloneRepository(
                    repoName.trim(),
                    gitUrl.trim(),
                    keepConnected,
                    keepConnected ? cloneToken.trim() : null
                );
                setRepoName('');
                setGitUrl('');
                setKeepConnected(true); // Reset to default
                setCloneToken('');
                setShowCloneModal(false);
                
                // Check remote status after cloning (to update UI)
                // Pass gitCtx directly from the clone result to avoid race condition
                if (clonedRepo.gitCtx) {
                    await checkRemote(clonedRepo.gitCtx);
                } else {
                    // Fallback: check after state update
                    setTimeout(async () => {
                        await checkRemote();
                    }, 100);
                }
                
                // Auto-load empty pipeline template if no pipeline file exists
                if (!clonedRepo.hasPipelineFile && pipelineHook) {
                    const { setNodes, setEdges, markPipelineLoaded } = pipelineHook;
                    if (setNodes && setEdges) {
                        // Import empty template
                        const { getEmptyPipelineTemplate, importYamlFromString } = await import('../utils/yamlTools');
                        const emptyTemplate = getEmptyPipelineTemplate();
                        importYamlFromString(emptyTemplate, setNodes, setEdges);
                        // Mark as loaded but with null path (new pipeline, not from file)
                        if (markPipelineLoaded) {
                            markPipelineLoaded(null);
                        }
                    }
                }
            } catch (error) {
                alert('Failed to clone repository: ' + error.message);
            }
        }
    };

    const handleOpenRepository = async (repoName) => {
        try {
            const loadedRepo = await openRepository(repoName);
            
            // Load scripts from repository into scriptsHook
            if (loadedRepo.scripts && setAllScripts) {
                // Convert repository script format to scriptsHook format
                const scriptsToLoad = {};
                Object.entries(loadedRepo.scripts).forEach(([scriptName, scriptData]) => {
                    // Handle both old format (string) and new format (object with type and data)
                    if (typeof scriptData === 'string') {
                        scriptsToLoad[scriptName] = {
                            type: 'map', // Default to map if type not specified
                            data: scriptData
                        };
                    } else {
                        scriptsToLoad[scriptName] = {
                            type: scriptData.type || 'map',
                            data: scriptData.data || scriptData
                        };
                    }
                });
                setAllScripts(scriptsToLoad);
            }
            
            // Auto-load empty pipeline template if no pipeline file exists
            if (!loadedRepo.hasPipelineFile && pipelineHook) {
                const { setNodes, setEdges, markPipelineLoaded } = pipelineHook;
                if (setNodes && setEdges) {
                    // Import empty template
                    const { getEmptyPipelineTemplate, importYamlFromString } = await import('../utils/yamlTools');
                    const emptyTemplate = getEmptyPipelineTemplate();
                    importYamlFromString(emptyTemplate, setNodes, setEdges);
                    // Mark as loaded but with null path (new pipeline, not from file)
                    if (markPipelineLoaded) {
                        markPipelineLoaded(null);
                    }
                }
            }
            
            setShowOpenModal(false);
        } catch (error) {
            console.error('Failed to open repository:', error);
            alert('Failed to open repository: ' + error.message);
        }
    };

    const handleDeleteRepository = async (e, repoName) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete repository "${repoName}"?`)) {
            try {
                await removeRepository(repoName);
            } catch (error) {
                alert('Failed to delete repository: ' + error.message);
            }
        }
    };

    const checkRemote = async (ctx = null) => {
        const contextToUse = ctx || gitCtx;
        if (!contextToUse) {
            setHasGitHubRemote(false);
            setRemoteRepoInfo(null);
            return;
        }
        try {
            const { hasRemote, getRemoteUrl } = await import('../utils/gitTools');
            const exists = await hasRemote(contextToUse, 'origin');
            setHasGitHubRemote(exists);
            
            if (exists) {
                // Get remote URL and parse it
                const remoteUrl = await getRemoteUrl(contextToUse, 'origin');
                if (remoteUrl) {
                    // Parse GitHub URL: https://github.com/username/repo.git or https://github.com/username/repo
                    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
                    if (match) {
                        const [, username, repo] = match;
                        // Build full GitHub URL (without .git)
                        const fullUrl = `https://github.com/${username}/${repo}`;
                        setRemoteRepoInfo({ username, repo, fullUrl });
                    } else {
                        setRemoteRepoInfo(null);
                    }
                } else {
                    setRemoteRepoInfo(null);
                }
            } else {
                setRemoteRepoInfo(null);
            }
        } catch (error) {
            setHasGitHubRemote(false);
            setRemoteRepoInfo(null);
        }
    };

    useEffect(() => {
        checkRemote();
    }, [gitCtx]);

    const handleExportToGitHub = async () => {
        if (!githubUsername.trim() || !githubToken.trim() || !githubRepoName.trim()) {
            alert('Please fill in all required fields');
            return;
        }

        setIsExporting(true);
        try {
            const result = await exportToGitHub(
                githubUsername.trim(),
                githubToken.trim(),
                githubRepoName.trim(),
                githubDescription.trim(),
                githubIsPrivate
            );
            
            setShowExportModal(false);
            setGithubUsername('');
            setGithubToken('');
            setGithubRepoName('');
            setGithubDescription('');
            setGithubIsPrivate(false);
            
            alert(`Successfully exported to GitHub!\nRepository: ${result.url}`);
            await checkRemote();
        } catch (error) {
            alert('Failed to export to GitHub: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    const handlePushToGitHub = async () => {
        try {
            await pushToGitHubRemote();
            alert('Successfully pushed to GitHub!');
        } catch (error) {
            // If token not found, prompt for it
            if (error.message && error.message.includes('token not found')) {
                setShowPushTokenModal(true);
            } else {
                alert('Failed to push to GitHub: ' + error.message);
            }
        }
    };

    const handlePullFromGitHub = async () => {
        try {
            await pullFromGitHubRemote();
            alert('Successfully pulled from GitHub!');
            // Reload the file tree to show updated files
            if (repository) {
                // Trigger a refresh by checking remote again
                await checkRemote();
            }
        } catch (error) {
            // If token not found, prompt for it
            if (error.message && error.message.includes('token not found')) {
                setShowPushTokenModal(true);
            } else {
                alert('Failed to pull from GitHub: ' + error.message);
            }
        }
    };

    const handlePushWithToken = async () => {
        if (!pushToken.trim()) {
            alert('Please enter your GitHub token');
            return;
        }

        try {
            // Store the token first
            if (repository) {
                const { storeGitHubToken } = await import('../utils/gitTools');
                storeGitHubToken(repository.name, pushToken.trim());
            }

            // Now try to push
            await pushToGitHubRemote();
            setShowPushTokenModal(false);
            setPushToken('');
            alert('Successfully pushed to GitHub!');
        } catch (error) {
            alert('Failed to push to GitHub: ' + error.message);
        }
    };

    const getFileContent = async (filePath) => {
        if (!gitCtx || !repository) return '';
        
        const { fs, path, dir: repoDir } = gitCtx;
        
        try {
            // Read file directly from BrowserFS
            const fullPath = path.join(repoDir, filePath);
            const content = await new Promise((resolve, reject) => {
                fs.readFile(fullPath, (err, data) => {
                    if (err) {
                        // File doesn't exist or error reading
                        resolve('');
                    } else {
                        resolve(data.toString());
                    }
                });
            });
            return content;
        } catch (error) {
            console.error('Error reading file from BrowserFS:', error);
            return '';
        }
    };

    const getFileLanguage = (fileName) => {
        if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) return 'yaml';
        if (fileName.endsWith('.py')) return 'python';
        if (fileName === 'Dockerfile' || fileName.endsWith('/Dockerfile')) return 'dockerfile';
        if (fileName.endsWith('.txt')) return 'plaintext';
        return 'plaintext';
    };

    const handleFileClick = async (filePath, fileName) => {
        if (!openModal) return;
        const content = await getFileContent(filePath);
        const language = getFileLanguage(fileName);
        openModal('view file', filePath, { content, language, fileName });
    };

    // Load file tree from BrowserFS
    useEffect(() => {
        const loadFileTree = async () => {
            if (!gitCtx || !repository) {
                setFileTree(null);
                return;
            }

            const { fs, path, dir: repoDir } = gitCtx;

            const readDir = async (dirPath, parentPath = '') => {
                const items = [];
                try {
                    const entries = await new Promise((resolve, reject) => {
                        fs.readdir(path.join(repoDir, dirPath), (err, entries) => {
                            if (err) resolve([]);
                            else resolve(entries || []);
                        });
                    });

                    for (const entry of entries) {
                        // Skip hidden files and folders (starting with .)
                        if (entry.startsWith('.')) continue;
                        
                        const fullPath = path.join(repoDir, dirPath, entry);
                        const relativePath = parentPath ? `${parentPath}/${entry}` : entry;
                        
                        try {
                            const stat = await new Promise((resolve, reject) => {
                                fs.stat(fullPath, (err, stat) => {
                                    if (err) reject(err);
                                    else resolve(stat);
                                });
                            });

                            if (stat.isDirectory()) {
                                // Recursively read children and nest them
                                const children = await readDir(path.join(dirPath, entry), relativePath);
                                if (children.length > 0) {
                                    items.push({
                                        name: entry,
                                        type: 'folder',
                                        icon: FolderOpen,
                                        children,
                                        path: relativePath
                                    });
                                }
                            } else {
                                items.push({
                                    name: entry,
                                    type: 'file',
                                    icon: entry.endsWith('.py') ? FileCode : File,
                                    path: relativePath
                                });
                            }
                        } catch (e) {
                            // Skip files we can't stat
                        }
                    }
                } catch (e) {
                    // Directory doesn't exist or error reading
                }
                return items;
            };

            const files = await readDir('');
            setFileTree(files);
        };

        loadFileTree();
    }, [gitCtx, repository, fileTreeVersion]);

    const toggleFolder = (folderPath) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderPath)) {
                newSet.delete(folderPath);
            } else {
                newSet.add(folderPath);
            }
            return newSet;
        });
    };

    const renderFileTree = () => {
        if (!isInitialized || !repository || !fileTree) {
            return null;
        }

        const files = fileTree;

        const renderFileItem = (file, depth = 0, key = '') => {
            const isFolder = file.type === 'folder';
            const currentPath = file.path || file.name;
            const isExpanded = expandedFolders.has(currentPath);
            const hasChildren = file.children && file.children.length > 0;
            
            // Use closed folder icon when collapsed, open when expanded
            const FolderIcon = isExpanded ? FolderOpen : Folder;
            const Icon = isFolder ? FolderIcon : (file.icon || File);
            const itemKey = key || file.name;
            
            return (
                <div key={itemKey} style={{ marginBottom: '2px' }}>
                    <div 
                        style={{
                            ...fileTreeStyles.item,
                            cursor: 'pointer',
                            paddingLeft: `${depth * 16 + 4}px`
                        }}
                        onClick={() => {
                            if (isFolder) {
                                toggleFolder(currentPath);
                            } else {
                                handleFileClick(currentPath, file.name);
                            }
                        }}
                        {...hoverHandlers.fileItem}
                    >
                        {isFolder && hasChildren && (
                            <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}>
                                {isExpanded ? (
                                    <ChevronDown size={12} style={{ color: '#64748b' }} />
                                ) : (
                                    <ChevronRight size={12} style={{ color: '#64748b' }} />
                                )}
                            </span>
                        )}
                        {!isFolder && <span style={{ width: '16px', display: 'inline-block' }} />}
                        <Icon size={14} style={{ marginRight: spacing.md, color: isFolder ? colors.primary : colors.text.tertiary }} />
                        <span style={fileTreeStyles.fileName}>{file.name}</span>
                    </div>
                    {isFolder && hasChildren && isExpanded && (
                        <div style={fileTreeStyles.children}>
                            {file.children.map((child, childIndex) => 
                                renderFileItem(child, depth + 1, `${itemKey}-${childIndex}`)
                            )}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div style={fileTreeStyles.container}>
                <div style={fileTreeStyles.header}>
                    <Folder size={16} style={{ marginRight: spacing.sm, color: colors.primary }} />
                    <span style={{ fontSize: typography.fontSize.md }}>{repository.name}</span>
                </div>
                {files.length > 0 ? (
                    files.map((file, index) => renderFileItem(file, 0, `file-${index}`, ''))
                ) : (
                    <div style={{
                        padding: spacing.xl,
                        textAlign: 'center',
                        color: colors.text.tertiary,
                        fontSize: typography.fontSize.base
                    }}>
                        <p style={{ margin: 0, lineHeight: '1.5' }}>No files yet. Create a pipeline and scripts to see them here.</p>
                    </div>
                )}
            </div>
        );
    };

    if (!isVisible) {
        return (
            <button
                onClick={onToggle}
                style={{ ...buttonStyles.toggle, left: spacing.sm }}
                title="Show directory sidebar"
                {...hoverHandlers.toggleButton}
            >
                <ChevronRight size={20} />
            </button>
        );
    }

    return (
        <>
            <aside style={{ ...sidebarStyles.container, ...sidebarStyles.containerLeft }}>
                <div style={sidebarStyles.headerRow}>
                    <span style={sidebarStyles.header}>Repository</span>
                    <div style={sidebarStyles.headerButtons}>
                        {!isInitialized ? (
                            <button
                                onClick={() => setShowInitModal(true)}
                                style={buttonStyles.icon}
                                title="Initialize repository"
                                {...hoverHandlers.iconButton}
                            >
                                <Plus size={16} />
                            </button>
                        ) : (
                            <button
                                onClick={clearRepository}
                                style={{ ...buttonStyles.icon, fontSize: '20px', fontWeight: typography.fontWeight.light }}
                                title="Clear repository"
                                {...hoverHandlers.deleteButton}
                            >
                                ×
                            </button>
                        )}
                        <button
                            onClick={onToggle}
                            style={buttonStyles.icon}
                            title="Hide directory sidebar"
                            {...hoverHandlers.iconButton}
                        >
                            <ChevronLeft size={16} />
                        </button>
                    </div>
                </div>

                {!isInitialized ? (
                    <div style={emptyStateStyles.container}>
                        <Folder size={48} style={{ color: colors.border.dark, marginBottom: spacing.md }} />
                        <p style={emptyStateStyles.text}>No repository initialized</p>
                        <div style={emptyStateStyles.buttonGroup}>
                            <button
                                onClick={() => setShowOpenModal(true)}
                                style={{ ...buttonStyles.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                {...hoverHandlers.openRepoButton}
                            >
                                <FolderOpen size={16} style={{ marginRight: spacing.sm }} />
                                Open Repository
                            </button>
                            <button
                                onClick={() => setShowInitModal(true)}
                                style={{ ...buttonStyles.primary, display: 'flex', alignItems: 'center' }}
                                {...hoverHandlers.primaryButton}
                            >
                                <Plus size={16} style={{ marginRight: spacing.sm }} />
                                New Repository
                            </button>
                            <button
                                onClick={() => setShowCloneModal(true)}
                                style={{ ...buttonStyles.primary, display: 'flex', alignItems: 'center', marginTop: spacing.md }}
                                {...hoverHandlers.primaryButton}
                            >
                                <FolderOpen size={16} style={{ marginRight: spacing.sm }} />
                                Clone Repo
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border.default}` }}>
                            {hasGitHubRemote ? (
                                <>
                                    <div style={{ display: 'flex', gap: spacing.sm }}>
                                        <button
                                            onClick={handlePullFromGitHub}
                                            style={{
                                                ...buttonStyles.secondary,
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            {...hoverHandlers.secondaryButton}
                                        >
                                            <Download size={16} style={{ marginRight: spacing.sm }} />
                                            Pull
                                        </button>
                                        <button
                                            onClick={handlePushToGitHub}
                                            style={{
                                                ...buttonStyles.primary,
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            {...hoverHandlers.primaryButton}
                                        >
                                            <Upload size={16} style={{ marginRight: spacing.sm }} />
                                            Push
                                        </button>
                                    </div>
                                    {remoteRepoInfo && (
                                        <a
                                            href={remoteRepoInfo.fullUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'block',
                                                marginTop: spacing.sm,
                                                fontSize: typography.fontSize.sm,
                                                color: colors.text.tertiary,
                                                textDecoration: 'none',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                transition: 'color 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.target.style.color = colors.primary;
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.color = colors.text.tertiary;
                                            }}
                                        >
                                            → {remoteRepoInfo.username}/{remoteRepoInfo.repo}
                                        </a>
                                    )}
                                </>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (repository) {
                                            setGithubRepoName(repository.name);
                                        }
                                        setShowExportModal(true);
                                    }}
                                    style={{
                                        ...buttonStyles.primary,
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    {...hoverHandlers.primaryButton}
                                >
                                    <Github size={16} style={{ marginRight: spacing.sm }} />
                                    Export repo to GitHub
                                </button>
                            )}
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: spacing.xs }}>
                            {renderFileTree()}
                        </div>
                    </>
                )}
            </aside>

            {showInitModal && (
                <div style={modalStyles.overlay} onClick={() => setShowInitModal(false)}>
                    <div style={{ ...modalStyles.container, ...modalStyles.containerSmall }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={modalStyles.title}>Initialize Repository</h3>
                        <p style={modalStyles.description}>Enter a name for your repository</p>
                        <input
                            type="text"
                            value={repoName}
                            onChange={(e) => setRepoName(e.target.value)}
                            placeholder="my-pipeline-repo"
                            style={inputStyles.input}
                            {...hoverHandlers.inputFocus}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleInitialize();
                                }
                            }}
                            autoFocus
                        />
                        <div style={modalStyles.buttonContainer}>
                            <button
                                onClick={() => {
                                    setShowInitModal(false);
                                    setRepoName('');
                                }}
                                style={buttonStyles.secondary}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInitialize}
                                disabled={!repoName.trim()}
                                style={{
                                    ...buttonStyles.primary,
                                    opacity: repoName.trim() ? 1 : 0.5,
                                    cursor: repoName.trim() ? 'pointer' : 'not-allowed'
                                }}
                            >
                                Initialize
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showOpenModal && (
                <div style={modalStyles.overlay} onClick={() => setShowOpenModal(false)}>
                    <div style={{ ...modalStyles.container, ...modalStyles.containerSmall }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={modalStyles.title}>Open Repository</h3>
                        <p style={modalStyles.description}>Select a repository to open</p>
                        <div style={{
                            maxHeight: '400px',
                            overflowY: 'auto',
                            marginBottom: spacing.xl,
                            border: `1px solid ${colors.border.default}`,
                            borderRadius: borderRadius.lg,
                            padding: spacing.sm
                        }}>
                            {savedRepositories.length === 0 ? (
                                <p style={{
                                    textAlign: 'center',
                                    color: colors.text.tertiary,
                                    fontSize: typography.fontSize.md,
                                    padding: spacing.xl
                                }}>No saved repositories found</p>
                            ) : (
                                savedRepositories.map((repo) => (
                                    <div
                                        key={repo.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: spacing.md,
                                            borderRadius: borderRadius.md,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            marginBottom: spacing.xs
                                        }}
                                        onClick={() => handleOpenRepository(repo.name)}
                                        {...hoverHandlers.repoListItem}
                                    >
                                        <Folder size={18} style={{ color: colors.primary, marginRight: spacing.md }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: typography.fontSize.md,
                                                fontWeight: typography.fontWeight.semibold,
                                                color: colors.text.primary,
                                                marginBottom: spacing.xs
                                            }}>{repo.name}</div>
                                            <div style={{
                                                fontSize: typography.fontSize.sm,
                                                color: colors.text.tertiary
                                            }}>
                                                Created: {new Date(repo.createdAt).toLocaleDateString()}
                                                {repo.lastModified && ` • Modified: ${new Date(repo.lastModified).toLocaleDateString()}`}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteRepository(e, repo.name)}
                                            style={{
                                                padding: spacing.md,
                                                background: 'transparent',
                                                border: 'none',
                                                borderRadius: borderRadius.xs,
                                                cursor: 'pointer',
                                                color: colors.text.tertiary,
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title="Delete repository"
                                            {...hoverHandlers.deleteButton}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div style={modalStyles.buttonContainer}>
                            <button
                                onClick={() => setShowOpenModal(false)}
                                style={buttonStyles.secondary}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCloneModal && (
                <div style={modalStyles.overlay} onClick={() => setShowCloneModal(false)}>
                    <div style={{ ...modalStyles.container, ...modalStyles.containerSmall }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={modalStyles.title}>Clone Repository</h3>
                        <p style={modalStyles.description}>Enter repository name and GitHub URL</p>
                        <input
                            type="text"
                            value={repoName}
                            onChange={(e) => setRepoName(e.target.value)}
                            placeholder="my-cloned-repo"
                            style={inputStyles.input}
                            {...hoverHandlers.inputFocus}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleClone();
                                }
                            }}
                        />
                        <input
                            type="text"
                            value={gitUrl}
                            onChange={(e) => setGitUrl(e.target.value)}
                            placeholder="https://github.com/username/repo.git"
                            style={inputStyles.input}
                            {...hoverHandlers.inputFocus}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleClone();
                                }
                            }}
                            autoFocus
                        />
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginTop: spacing.md,
                            cursor: 'pointer'
                        }}>
                            <input
                                type="checkbox"
                                checked={keepConnected}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setKeepConnected(checked);
                                    if (!checked) setCloneToken('');
                                }}
                                style={{ marginRight: spacing.sm }}
                            />
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary }}>
                                Keep connected to original repository
                            </span>
                        </label>
                        {keepConnected && (
                            <input
                                type="password"
                                value={cloneToken}
                                onChange={(e) => setCloneToken(e.target.value)}
                                placeholder="Personal Access Token (optional; needed for private repos)"
                                style={{ ...inputStyles.input, marginTop: spacing.md }}
                                {...hoverHandlers.inputFocus}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleClone();
                                    }
                                }}
                            />
                        )}
                        <div style={modalStyles.buttonContainer}>
                            <button
                                onClick={() => {
                                    setShowCloneModal(false);
                                    setRepoName('');
                                    setGitUrl('');
                                    setKeepConnected(true); // Reset to default
                                    setCloneToken('');
                                }}
                                style={buttonStyles.secondary}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClone}
                                disabled={!repoName.trim() || !gitUrl.trim()}
                                style={{
                                    ...buttonStyles.primary,
                                    opacity: (repoName.trim() && gitUrl.trim()) ? 1 : 0.5,
                                    cursor: (repoName.trim() && gitUrl.trim()) ? 'pointer' : 'not-allowed'
                                }}
                            >
                                Clone
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && (
                <div style={modalStyles.overlay} onClick={() => !isExporting && setShowExportModal(false)}>
                    <div style={{ ...modalStyles.container, maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={modalStyles.title}>Export to GitHub</h3>
                        <p style={modalStyles.description}>Enter your GitHub credentials and repository details</p>
                        <input
                            type="text"
                            value={githubUsername}
                            onChange={(e) => setGithubUsername(e.target.value)}
                            placeholder="GitHub username"
                            style={inputStyles.input}
                            disabled={isExporting}
                            {...hoverHandlers.inputFocus}
                        />
                        <input
                            type="password"
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            placeholder="Personal Access Token (with repo scope)"
                            style={{ ...inputStyles.input, marginTop: spacing.md }}
                            disabled={isExporting}
                            {...hoverHandlers.inputFocus}
                        />
                        <input
                            type="text"
                            value={githubRepoName}
                            onChange={(e) => setGithubRepoName(e.target.value)}
                            placeholder="Repository name"
                            style={{ ...inputStyles.input, marginTop: spacing.md }}
                            disabled={isExporting}
                            {...hoverHandlers.inputFocus}
                        />
                        <input
                            type="text"
                            value={githubDescription}
                            onChange={(e) => setGithubDescription(e.target.value)}
                            placeholder="Description (optional)"
                            style={{ ...inputStyles.input, marginTop: spacing.md }}
                            disabled={isExporting}
                            {...hoverHandlers.inputFocus}
                        />
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginTop: spacing.md,
                            cursor: isExporting ? 'not-allowed' : 'pointer',
                            opacity: isExporting ? 0.5 : 1
                        }}>
                            <input
                                type="checkbox"
                                checked={githubIsPrivate}
                                onChange={(e) => setGithubIsPrivate(e.target.checked)}
                                disabled={isExporting}
                                style={{ marginRight: spacing.sm }}
                            />
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary }}>
                                Private repository
                            </span>
                        </label>
                        <div style={{ ...modalStyles.buttonContainer, marginTop: spacing.lg }}>
                            <button
                                onClick={() => {
                                    if (!isExporting) {
                                        setShowExportModal(false);
                                        setGithubUsername('');
                                        setGithubToken('');
                                        setGithubRepoName('');
                                        setGithubDescription('');
                                        setGithubIsPrivate(false);
                                    }
                                }}
                                style={buttonStyles.secondary}
                                disabled={isExporting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExportToGitHub}
                                disabled={!githubUsername.trim() || !githubToken.trim() || !githubRepoName.trim() || isExporting}
                                style={{
                                    ...buttonStyles.primary,
                                    opacity: (githubUsername.trim() && githubToken.trim() && githubRepoName.trim() && !isExporting) ? 1 : 0.5,
                                    cursor: (githubUsername.trim() && githubToken.trim() && githubRepoName.trim() && !isExporting) ? 'pointer' : 'not-allowed'
                                }}
                            >
                                {isExporting ? 'Exporting...' : 'Export'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPushTokenModal && (
                <div style={modalStyles.overlay} onClick={() => setShowPushTokenModal(false)}>
                    <div style={{ ...modalStyles.container, ...modalStyles.containerSmall }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={modalStyles.title}>GitHub Token Required</h3>
                        <p style={modalStyles.description}>Enter your GitHub Personal Access Token to push changes</p>
                        <input
                            type="password"
                            value={pushToken}
                            onChange={(e) => setPushToken(e.target.value)}
                            placeholder="Personal Access Token"
                            style={inputStyles.input}
                            {...hoverHandlers.inputFocus}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handlePushWithToken();
                                }
                            }}
                            autoFocus
                        />
                        <div style={modalStyles.buttonContainer}>
                            <button
                                onClick={() => {
                                    setShowPushTokenModal(false);
                                    setPushToken('');
                                }}
                                style={buttonStyles.secondary}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePushWithToken}
                                disabled={!pushToken.trim()}
                                style={{
                                    ...buttonStyles.primary,
                                    opacity: pushToken.trim() ? 1 : 0.5,
                                    cursor: pushToken.trim() ? 'pointer' : 'not-allowed'
                                }}
                            >
                                Push
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};


export default DirectorySidebar;

