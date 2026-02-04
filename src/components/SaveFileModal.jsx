import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, FileText, FileCode } from 'lucide-react';
import { modalStyles, inputStyles, buttonStyles, fileTreeStyles } from '../styles/components';
import { colors, spacing, borderRadius, typography } from '../styles/theme';
import { hoverHandlers } from '../styles/hoverUtils';

/**
 * Save-as style modal: user picks a folder destination in the repo tree.
 * - mode 'pipeline': also pick a pipeline filename. onConfirm(fullPipelinePath)
 * - mode 'script': filenames derived from scriptName. onConfirm(directoryPath) for <scriptName>.py and Dockerfile.<scriptName>
 */
export default function SaveFileModal({ isOpen, onClose, onConfirm, repositoryHook, mode = 'pipeline', scriptName = '' }) {
    const { loadFileTree } = repositoryHook || {};
    const [fileTree, setFileTree] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [selectedFolderPath, setSelectedFolderPath] = useState(''); // '' = repo root
    const [pipelineName, setPipelineName] = useState('pipeline.yaml');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const sanitizedScriptName = (scriptName || '').replace(/[^a-zA-Z0-9-_]/g, '_') || 'script';
    const scriptPyPath = selectedFolderPath ? `${selectedFolderPath}/${sanitizedScriptName}.py` : `${sanitizedScriptName}.py`;
    const scriptDockerfilePath = selectedFolderPath ? `${selectedFolderPath}/Dockerfile.${sanitizedScriptName}` : `Dockerfile.${sanitizedScriptName}`;

    useEffect(() => {
        if (isOpen && loadFileTree) {
            setLoading(true);
            setError(null);
            loadFileTree()
                .then((tree) => {
                    setFileTree(tree || []);
                    setSelectedFolderPath('');
                    setPipelineName('pipeline.yaml');
                    setExpandedFolders(new Set());
                })
                .catch((err) => {
                    setError(err?.message || 'Failed to load repository structure');
                    setFileTree([]);
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, loadFileTree]);

    const toggleFolder = (folderPath) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderPath)) next.delete(folderPath);
            else next.add(folderPath);
            return next;
        });
    };

    const fullPath = selectedFolderPath
        ? `${selectedFolderPath}/${pipelineName}`
        : pipelineName;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (mode === 'pipeline') {
            let name = pipelineName.trim();
            if (!name) {
                setError('Pipeline name cannot be empty');
                return;
            }
            if (!name.endsWith('.yaml') && !name.endsWith('.yml')) {
                name += '.yaml';
            }
            if (name.includes('/') || name.includes('\\')) {
                setError('Pipeline name cannot contain path separators');
                return;
            }
            setError(null);
            const finalPath = selectedFolderPath ? `${selectedFolderPath}/${name}` : name;
            onConfirm(finalPath);
        } else {
            // script mode
            if (!sanitizedScriptName) {
                setError('Script name cannot be empty');
                return;
            }
            setError(null);
            const dirPath = selectedFolderPath || '.';
            onConfirm(dirPath);
        }
        onClose();
    };

    if (!isOpen) return null;

    const renderFolderItem = (item, depth = 0, key = '') => {
        if (item.type !== 'folder') return null;
        const path = item.path || item.name;
        const isExpanded = expandedFolders.has(path);
        const hasChildren = item.children && item.children.length > 0;
        const isSelected = selectedFolderPath === path;

        return (
            <div key={key || path} style={{ marginBottom: '2px' }}>
                <div
                    style={{
                        ...fileTreeStyles.item,
                        paddingLeft: `${depth * 16 + 4}px`,
                        background: isSelected ? colors.primary + '18' : undefined,
                        borderLeft: isSelected ? `3px solid ${colors.primary}` : '3px solid transparent',
                    }}
                    onClick={() => setSelectedFolderPath(path)}
                    {...hoverHandlers.fileItem}
                >
                    {hasChildren && (
                        <span
                            style={{ marginRight: '4px', display: 'inline-flex', cursor: 'pointer' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleFolder(path);
                            }}
                        >
                            {isExpanded ? (
                                <ChevronDown size={12} style={{ color: '#64748b' }} />
                            ) : (
                                <ChevronRight size={12} style={{ color: '#64748b' }} />
                            )}
                        </span>
                    )}
                    {!hasChildren && <span style={{ width: '16px', display: 'inline-block' }} />}
                    {isExpanded ? (
                        <FolderOpen size={14} style={{ marginRight: spacing.md, color: colors.primary }} />
                    ) : (
                        <Folder size={14} style={{ marginRight: spacing.md, color: colors.primary }} />
                    )}
                    <span style={fileTreeStyles.fileName}>{item.name}</span>
                </div>
                {hasChildren && isExpanded && (
                    <div style={fileTreeStyles.children}>
                        {item.children.map((child, i) =>
                            renderFolderItem(child, depth + 1, `${key}-${child.path}-${i}`)
                        )}
                    </div>
                )}
            </div>
        );
    };

    const isScript = mode === 'script';
    const Icon = isScript ? FileCode : FileText;
    const title = isScript ? 'Save script as' : 'Save pipeline as';
    const description = isScript
        ? 'Choose where to save the script and Dockerfile in the repository.'
        : 'Choose where to save the pipeline in the repository and give it a name.';

    return (
        <div style={modalStyles.overlay} onClick={onClose}>
            <div
                style={{
                    ...modalStyles.container,
                    ...modalStyles.containerMedium,
                    maxWidth: '480px',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                    <Icon size={24} style={{ color: colors.primary }} />
                    <h2 style={modalStyles.title}>{title}</h2>
                </div>
                <p style={{ ...modalStyles.description, marginBottom: spacing.lg }}>
                    {description}
                </p>

                {loading ? (
                    <p style={{ color: colors.text.tertiary, margin: spacing.xl }}>Loading repository structure…</p>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
                        <div>
                            <label style={{ ...inputStyles.label, display: 'block', marginBottom: spacing.sm }}>
                                Destination folder
                            </label>
                            <div
                                style={{
                                    ...fileTreeStyles.container,
                                    maxHeight: '200px',
                                    overflow: 'auto',
                                    border: `1px solid ${colors.border.default}`,
                                    borderRadius: borderRadius.md,
                                    padding: spacing.sm,
                                }}
                            >
                                <div
                                    style={{
                                        ...fileTreeStyles.item,
                                        background: selectedFolderPath === '' ? colors.primary + '18' : undefined,
                                        borderLeft: selectedFolderPath === '' ? `3px solid ${colors.primary}` : '3px solid transparent',
                                    }}
                                    onClick={() => setSelectedFolderPath('')}
                                    {...hoverHandlers.fileItem}
                                >
                                    <Folder size={14} style={{ marginRight: spacing.md, color: colors.primary }} />
                                    <span style={fileTreeStyles.fileName}>(Repository root)</span>
                                </div>
                                {fileTree.map((item, i) => renderFolderItem(item, 0, `root-${i}`))}
                            </div>
                        </div>

                        {isScript ? (
                            <div>
                                <p style={{ marginTop: spacing.xs, fontSize: typography.fontSize.sm, color: colors.text.tertiary }}>
                                    Will save: <strong style={{ color: colors.text.secondary }}>{scriptPyPath}</strong> and <strong style={{ color: colors.text.secondary }}>{scriptDockerfilePath}</strong>
                                </p>
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="save-pipeline-name" style={{ ...inputStyles.label, display: 'block', marginBottom: spacing.sm }}>
                                    Pipeline name
                                </label>
                                <input
                                    id="save-pipeline-name"
                                    type="text"
                                    value={pipelineName}
                                    onChange={(e) => setPipelineName(e.target.value)}
                                    placeholder="pipeline.yaml"
                                    style={inputStyles.input}
                                    autoFocus
                                />
                                <p style={{ marginTop: spacing.xs, fontSize: typography.fontSize.sm, color: colors.text.tertiary }}>
                                    Will save to: <strong style={{ color: colors.text.secondary }}>{fullPath}</strong>
                                </p>
                            </div>
                        )}

                        {error && (
                            <p style={{ color: colors.danger, fontSize: typography.fontSize.sm, margin: 0 }}>
                                {error}
                            </p>
                        )}

                        <div style={modalStyles.buttonContainer}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={buttonStyles.secondary}
                                {...hoverHandlers.secondaryButton}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                style={buttonStyles.success}
                                {...hoverHandlers.successButton}
                            >
                                {isScript ? 'Save script' : 'Save pipeline'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
