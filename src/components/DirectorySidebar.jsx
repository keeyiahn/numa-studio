import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronLeft, ChevronRight, ChevronDown, Plus, FolderOpen, FileCode, Trash2 } from 'lucide-react';

const DirectorySidebar = ({ repositoryHook, isVisible = true, onToggle, modalHook, scriptsHook }) => {
    const { repository, isInitialized, savedRepositories, initializeRepository, cloneRepository, openRepository, removeRepository, clearRepository, gitCtx } = repositoryHook;
    const { openModal } = modalHook || {};
    const { setAllScripts } = scriptsHook || {};
    const [showInitModal, setShowInitModal] = useState(false);
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloneModal, setShowCloneModal] = useState(false);
    const [repoName, setRepoName] = useState('');
    const [gitUrl, setGitUrl] = useState('');
    const [fileTree, setFileTree] = useState(null);
    const [expandedFolders, setExpandedFolders] = useState(new Set());

    const handleInitialize = async () => {
        if (repoName.trim()) {
            await initializeRepository(repoName.trim());
            setRepoName('');
            setShowInitModal(false);
        }
    };

    const handleClone = async () => {
        if (repoName.trim() && gitUrl.trim()) {
            try {
                await cloneRepository(repoName.trim(), gitUrl.trim());
                setRepoName('');
                setGitUrl('');
                setShowCloneModal(false);
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

    const getFileContent = async (filePath) => {
        if (!gitCtx || !repository) return '';
        
        const { fs, path } = gitCtx;
        const repoDir = '/';
        
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

            const { fs, path } = gitCtx;
            const repoDir = '/';

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
    }, [gitCtx, repository]);

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
                            ...styles.fileItem,
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
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                            if (!isFolder) {
                                e.currentTarget.style.color = '#3b82f6';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            if (!isFolder) {
                                e.currentTarget.style.color = '#475569';
                            }
                        }}
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
                        <Icon size={14} style={{ marginRight: '6px', color: isFolder ? '#3b82f6' : '#64748b' }} />
                        <span style={styles.fileName}>{file.name}</span>
                    </div>
                    {isFolder && hasChildren && isExpanded && (
                        <div style={styles.children}>
                            {file.children.map((child, childIndex) => 
                                renderFileItem(child, depth + 1, `${itemKey}-${childIndex}`)
                            )}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div style={styles.fileTree}>
                <div style={styles.repoHeader}>
                    <Folder size={16} style={{ marginRight: '8px', color: '#3b82f6' }} />
                    <span style={styles.repoName}>{repository.name}</span>
                </div>
                {files.length > 0 ? (
                    files.map((file, index) => renderFileItem(file, 0, `file-${index}`, ''))
                ) : (
                    <div style={styles.emptyRepo}>
                        <p style={styles.emptyRepoText}>No files yet. Create a pipeline and scripts to see them here.</p>
                    </div>
                )}
            </div>
        );
    };

    if (!isVisible) {
        return (
            <button
                onClick={onToggle}
                style={styles.toggleButton}
                title="Show directory sidebar"
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                <ChevronRight size={20} />
            </button>
        );
    }

    return (
        <>
            <aside style={styles.sidebar}>
                <div style={styles.headerRow}>
                    <span style={styles.header}>Repository</span>
                    <div style={styles.headerButtons}>
                        {!isInitialized ? (
                            <button
                                onClick={() => setShowInitModal(true)}
                                style={styles.initButton}
                                title="Initialize repository"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#e2e8f0';
                                    e.currentTarget.style.color = '#3b82f6';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                    e.currentTarget.style.color = '#475569';
                                }}
                            >
                                <Plus size={16} />
                            </button>
                        ) : (
                            <button
                                onClick={clearRepository}
                                style={styles.clearButton}
                                title="Clear repository"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#fee2e2';
                                    e.currentTarget.style.color = '#dc2626';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                    e.currentTarget.style.color = '#475569';
                                }}
                            >
                                ×
                            </button>
                        )}
                        <button
                            onClick={onToggle}
                            style={styles.toggleIconBtn}
                            title="Hide directory sidebar"
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e2e8f0';
                                e.currentTarget.style.color = '#3b82f6';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f1f5f9';
                                e.currentTarget.style.color = '#475569';
                            }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                    </div>
                </div>

                {!isInitialized ? (
                    <div style={styles.emptyState}>
                        <Folder size={48} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                        <p style={styles.emptyText}>No repository initialized</p>
                        <div style={styles.buttonGroup}>
                            <button
                                onClick={() => setShowOpenModal(true)}
                                style={styles.openRepoButton}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#e2e8f0';
                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                }}
                            >
                                <FolderOpen size={16} style={{ marginRight: '8px' }} />
                                Open Repository
                            </button>
                            <button
                                onClick={() => setShowInitModal(true)}
                                style={styles.initRepoButton}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#2563eb';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#3b82f6';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <Plus size={16} style={{ marginRight: '8px' }} />
                                New Repository
                            </button>
                            <button
                                onClick={() => setShowCloneModal(true)}
                                style={styles.cloneRepoButton}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#2563eb';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#3b82f6';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <FolderOpen size={16} style={{ marginRight: '8px' }} />
                                Clone Repo
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={styles.content}>
                        {renderFileTree()}
                    </div>
                )}
            </aside>

            {showInitModal && (
                <div style={styles.modalOverlay} onClick={() => setShowInitModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h3 style={styles.modalTitle}>Initialize Repository</h3>
                        <p style={styles.modalDescription}>Enter a name for your repository</p>
                        <input
                            type="text"
                            value={repoName}
                            onChange={(e) => setRepoName(e.target.value)}
                            placeholder="my-pipeline-repo"
                            style={styles.modalInput}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleInitialize();
                                }
                            }}
                            autoFocus
                        />
                        <div style={styles.modalButtons}>
                            <button
                                onClick={() => {
                                    setShowInitModal(false);
                                    setRepoName('');
                                }}
                                style={styles.modalButtonSecondary}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInitialize}
                                disabled={!repoName.trim()}
                                style={{
                                    ...styles.modalButton,
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
                <div style={styles.modalOverlay} onClick={() => setShowOpenModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h3 style={styles.modalTitle}>Open Repository</h3>
                        <p style={styles.modalDescription}>Select a repository to open</p>
                        <div style={styles.repoList}>
                            {savedRepositories.length === 0 ? (
                                <p style={styles.noReposText}>No saved repositories found</p>
                            ) : (
                                savedRepositories.map((repo) => (
                                    <div
                                        key={repo.name}
                                        style={styles.repoListItem}
                                        onClick={() => handleOpenRepository(repo.name)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#f8fafc';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <Folder size={18} style={{ color: '#3b82f6', marginRight: '10px' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={styles.repoListItemName}>{repo.name}</div>
                                            <div style={styles.repoListItemMeta}>
                                                Created: {new Date(repo.createdAt).toLocaleDateString()}
                                                {repo.lastModified && ` • Modified: ${new Date(repo.lastModified).toLocaleDateString()}`}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteRepository(e, repo.name)}
                                            style={styles.deleteRepoButton}
                                            title="Delete repository"
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#fee2e2';
                                                e.currentTarget.style.color = '#dc2626';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = '#64748b';
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div style={styles.modalButtons}>
                            <button
                                onClick={() => setShowOpenModal(false)}
                                style={styles.modalButtonSecondary}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCloneModal && (
                <div style={styles.modalOverlay} onClick={() => setShowCloneModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h3 style={styles.modalTitle}>Clone Repository</h3>
                        <p style={styles.modalDescription}>Enter repository name and GitHub URL</p>
                        <input
                            type="text"
                            value={repoName}
                            onChange={(e) => setRepoName(e.target.value)}
                            placeholder="my-cloned-repo"
                            style={styles.modalInput}
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
                            style={styles.modalInput}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleClone();
                                }
                            }}
                            autoFocus
                        />
                        <div style={styles.modalButtons}>
                            <button
                                onClick={() => {
                                    setShowCloneModal(false);
                                    setRepoName('');
                                    setGitUrl('');
                                }}
                                style={styles.modalButtonSecondary}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClone}
                                disabled={!repoName.trim() || !gitUrl.trim()}
                                style={{
                                    ...styles.modalButton,
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
        </>
    );
};

const styles = {
    sidebar: {
        height: '100vh',
        width: '240px',
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 16px',
        gap: '16px',
        fontSize: '14px',
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.02)',
        transition: 'transform 0.3s ease, width 0.3s ease',
        transform: 'translateX(0)',
        overflow: 'hidden'
    },
    headerRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px',
        marginBottom: '8px'
    },
    header: {
        fontWeight: '700',
        fontSize: '16px',
        color: '#0f172a',
        letterSpacing: '-0.01em'
    },
    headerButtons: {
        display: 'flex',
        gap: '6px',
        alignItems: 'center'
    },
    initButton: {
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: 'none',
        background: '#f1f5f9',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#475569',
        transition: 'all 0.2s ease',
        padding: 0
    },
    clearButton: {
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: 'none',
        background: '#f1f5f9',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#475569',
        transition: 'all 0.2s ease',
        padding: 0,
        fontSize: '20px',
        fontWeight: '300'
    },
    toggleIconBtn: {
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: 'none',
        background: '#f1f5f9',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#475569',
        transition: 'all 0.2s ease',
        padding: 0
    },
    toggleButton: {
        position: 'fixed',
        left: '8px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: 'none',
        background: '#f1f5f9',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#475569',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        zIndex: 100,
        padding: 0
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        flex: 1
    },
    emptyText: {
        fontSize: '13px',
        color: '#64748b',
        marginBottom: '20px'
    },
    buttonGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '100%',
        maxWidth: '200px'
    },
    openRepoButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 16px',
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
    },
    initRepoButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
    },
    cloneRepoButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        marginTop: '10px'
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        paddingRight: '4px'
    },
    fileTree: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    },
    repoHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        background: '#f8fafc',
        borderRadius: '6px',
        marginBottom: '8px',
        fontWeight: '600',
        color: '#0f172a'
    },
    repoName: {
        fontSize: '14px'
    },
    fileItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        borderRadius: '4px',
        fontSize: '13px',
        color: '#475569',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        userSelect: 'none'
    },
    fileName: {
        fontSize: '13px'
    },
    children: {
        marginLeft: '20px',
        marginTop: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
    },
    childItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#64748b'
    },
    childFileName: {
        fontSize: '12px'
    },
    emptyRepo: {
        padding: '20px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '13px'
    },
    emptyRepoText: {
        margin: 0,
        lineHeight: '1.5'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000
    },
    modal: {
        background: '#ffffff',
        padding: '28px',
        width: '400px',
        maxWidth: '90vw',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e2e8f0'
    },
    modalTitle: {
        margin: 0,
        fontSize: '20px',
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: '8px'
    },
    modalDescription: {
        margin: '0 0 20px 0',
        fontSize: '14px',
        color: '#64748b'
    },
    modalInput: {
        width: '100%',
        padding: '12px 16px',
        fontSize: '14px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: '#ffffff',
        color: '#0f172a',
        marginBottom: '20px',
        boxSizing: 'border-box'
    },
    modalButtons: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end'
    },
    modalButton: {
        padding: '10px 20px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        transition: 'all 0.2s ease'
    },
    modalButtonSecondary: {
        padding: '10px 20px',
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        transition: 'all 0.2s ease'
    },
    repoList: {
        maxHeight: '400px',
        overflowY: 'auto',
        marginBottom: '20px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '8px'
    },
    repoListItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '4px'
    },
    repoListItemName: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: '4px'
    },
    repoListItemMeta: {
        fontSize: '12px',
        color: '#64748b'
    },
    deleteRepoButton: {
        padding: '6px',
        background: 'transparent',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        color: '#64748b',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    noReposText: {
        textAlign: 'center',
        color: '#64748b',
        fontSize: '14px',
        padding: '20px'
    }
};

export default DirectorySidebar;

