import React, { useState } from 'react';
import { Folder, File, ChevronLeft, ChevronRight, Plus, FolderOpen, FileCode } from 'lucide-react';
import { generateDirectoryStructure } from '../utils/repositoryTools';

const DirectorySidebar = ({ repositoryHook, isVisible = true, onToggle, modalHook }) => {
    const { repository, isInitialized, initializeRepository, clearRepository } = repositoryHook;
    const { openModal } = modalHook || {};
    const [showInitModal, setShowInitModal] = useState(false);
    const [repoName, setRepoName] = useState('');

    const handleInitialize = () => {
        if (repoName.trim()) {
            initializeRepository(repoName.trim());
            setRepoName('');
            setShowInitModal(false);
        }
    };

    const getFileContent = (filePath) => {
        if (!repository) return '';
        const structure = generateDirectoryStructure(repository);
        if (!structure) return '';
        
        // Handle root level files
        if (filePath === 'pipeline.yaml') {
            return structure['pipeline.yaml'] || '';
        }
        if (filePath === 'requirements.txt') {
            return structure['requirements.txt'] || '';
        }
        
        // Handle scripts
        if (filePath.startsWith('scripts/')) {
            const fileName = filePath.replace('scripts/', '');
            return structure.scripts?.[fileName] || '';
        }
        
        // Handle dockerfiles (can have nested paths like "script-name/Dockerfile")
        if (filePath.startsWith('dockerfiles/')) {
            const filePathClean = filePath.replace('dockerfiles/', '');
            return structure.dockerfiles?.[filePathClean] || '';
        }
        
        // Handle manifests - check for deployments first (more specific)
        if (filePath.includes('manifests/deployments/')) {
            const fileName = filePath.split('manifests/deployments/')[1];
            return structure.manifests?.deployments?.[fileName] || '';
        }
        if (filePath.includes('manifests/services/')) {
            const fileName = filePath.split('manifests/services/')[1];
            return structure.manifests?.services?.[fileName] || '';
        }
        
        return '';
    };

    const getFileLanguage = (fileName) => {
        if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) return 'yaml';
        if (fileName.endsWith('.py')) return 'python';
        if (fileName === 'Dockerfile' || fileName.endsWith('/Dockerfile')) return 'dockerfile';
        if (fileName.endsWith('.txt')) return 'plaintext';
        return 'plaintext';
    };

    const handleFileClick = (filePath, fileName) => {
        if (!openModal) return;
        const content = getFileContent(filePath);
        const language = getFileLanguage(fileName);
        openModal('view file', filePath, { content, language, fileName });
    };

    const renderFileTree = () => {
        if (!isInitialized || !repository) {
            return null;
        }

        const structure = generateDirectoryStructure(repository);
        const files = [];
        
        // Pipeline file
        if (structure && structure['pipeline.yaml']) {
            files.push({ name: 'pipeline.yaml', type: 'file', icon: File });
        }

        // Requirements file
        if (structure && structure['requirements.txt']) {
            files.push({ name: 'requirements.txt', type: 'file', icon: FileCode });
        }

        // Scripts directory
        const scriptFiles = structure?.scripts ? Object.keys(structure.scripts) : [];
        if (scriptFiles.length > 0) {
            files.push({ 
                name: 'scripts', 
                type: 'folder', 
                icon: FolderOpen, 
                children: scriptFiles.map(f => ({ name: f, type: 'file', icon: FileCode }))
            });
        }

        // Dockerfiles directory
        const dockerfileFiles = structure?.dockerfiles ? Object.keys(structure.dockerfiles) : [];
        if (dockerfileFiles.length > 0) {
            files.push({ 
                name: 'dockerfiles', 
                type: 'folder', 
                icon: FolderOpen, 
                children: dockerfileFiles.map(f => ({ name: f, type: 'file', icon: File }))
            });
        }

        // Manifests directory
        const manifestDeployments = structure?.manifests?.deployments ? Object.keys(structure.manifests.deployments) : [];
        const manifestServices = structure?.manifests?.services ? Object.keys(structure.manifests.services) : [];
        
        if (manifestDeployments.length > 0 || manifestServices.length > 0) {
            const manifestChildren = [];
            if (manifestDeployments.length > 0) {
                manifestChildren.push({ 
                    name: 'deployments', 
                    type: 'folder', 
                    icon: FolderOpen, 
                    children: manifestDeployments.map(f => ({ name: f, type: 'file', icon: File }))
                });
            }
            if (manifestServices.length > 0) {
                manifestChildren.push({ 
                    name: 'services', 
                    type: 'folder', 
                    icon: FolderOpen, 
                    children: manifestServices.map(f => ({ name: f, type: 'file', icon: File }))
                });
            }
            files.push({ 
                name: 'manifests', 
                type: 'folder', 
                icon: FolderOpen,
                children: manifestChildren
            });
        }

        const renderFileItem = (file, depth = 0, key = '', parentPath = '') => {
            const isFolder = file.type === 'folder';
            const Icon = file.icon || (isFolder ? FolderOpen : File);
            const itemKey = key || file.name;
            const currentPath = parentPath ? `${parentPath}/${file.name}` : file.name;
            
            return (
                <div key={itemKey} style={{ marginLeft: `${depth * 16}px`, marginBottom: '2px' }}>
                    <div 
                        style={{
                            ...styles.fileItem,
                            cursor: isFolder ? 'default' : 'pointer'
                        }}
                        onClick={() => !isFolder && handleFileClick(currentPath, file.name)}
                        onMouseEnter={(e) => {
                            if (!isFolder) {
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.color = '#3b82f6';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isFolder) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#475569';
                            }
                        }}
                    >
                        <Icon size={14} style={{ marginRight: '6px', color: isFolder ? '#3b82f6' : '#64748b' }} />
                        <span style={styles.fileName}>{file.name}</span>
                    </div>
                    {file.children && file.children.length > 0 && (
                        <div style={styles.children}>
                            {file.children.map((child, childIndex) => 
                                renderFileItem(child, depth + 1, `${itemKey}-${childIndex}`, currentPath)
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
                            Initialize Repository
                        </button>
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
    }
};

export default DirectorySidebar;

