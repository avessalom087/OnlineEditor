import React, { useState } from 'react';

// Helper to convert flat paths into a tree structure
function buildTree(paths, configs, searchQuery) {
  const root = { name: 'root', isDirectory: true, children: {}, path: '' };
  
  const queryLower = searchQuery.toLowerCase();

  for (const pathStr of paths) {
    // If there is a search query, filter out files that don't match the path or filename
    if (queryLower && !pathStr.toLowerCase().includes(queryLower)) {
      continue;
    }

    const parts = pathStr.split('/');
    let current = root;
    let accumulatedPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children[part] = {
          name: part,
          isDirectory: false,
          path: pathStr,
          config: configs[pathStr]
        };
      } else {
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            isDirectory: true,
            children: {},
            path: accumulatedPath
          };
        }
        current = current.children[part];
      }
    }
  }

  return root;
}

function FileTreeNode({ node, level, selectedPath, onSelectFile, dirtyFiles }) {
  const [collapsed, setCollapsed] = useState(false);

  const indent = level * 12;

  if (node.isDirectory) {
    const childrenKeys = Object.keys(node.children);
    // Sort directories first, then files
    childrenKeys.sort((a, b) => {
      const nodeA = node.children[a];
      const nodeB = node.children[b];
      if (nodeA.isDirectory && !nodeB.isDirectory) return -1;
      if (!nodeA.isDirectory && nodeB.isDirectory) return 1;
      return a.localeCompare(b);
    });

    if (childrenKeys.length === 0) return null;

    return (
      <div style={{ userSelect: 'none' }}>
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px 6px ' + (12 + indent) + 'px',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            borderBottom: '1px solid rgba(30, 48, 30, 0.2)',
            transition: 'background 0.1s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(149, 192, 149, 0.05)'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ 
            display: 'inline-block', 
            width: '14px', 
            marginRight: '6px',
            fontFamily: 'monospace',
            textAlign: 'center' 
          }}>
            {collapsed ? '⊞' : '⊟'}
          </span>
          <span style={{ 
            fontFamily: 'var(--font-heading)', 
            fontWeight: '600', 
            letterSpacing: '1px',
            color: 'var(--text-primary)'
          }}>
            {node.name.toUpperCase()}
          </span>
        </div>
        {!collapsed && (
          <div>
            {childrenKeys.map(key => (
              <FileTreeNode
                key={node.children[key].path}
                node={node.children[key]}
                level={level + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                dirtyFiles={dirtyFiles}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File rendering
  const isSelected = selectedPath === node.path;
  const isDirty = dirtyFiles.has(node.path);
  const success = node.config ? node.config.success : true;

  let fileColor = 'var(--text-primary)';
  if (!success) {
    fileColor = 'var(--danger-color)';
  } else if (isSelected) {
    fileColor = 'var(--text-glow)';
  }

  return (
    <div
      onClick={() => onSelectFile(node.path)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px 6px ' + (16 + indent) + 'px',
        cursor: 'pointer',
        fontSize: '13px',
        background: isSelected ? 'rgba(149, 192, 149, 0.1)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
        color: fileColor,
        borderBottom: '1px solid rgba(30, 48, 30, 0.1)',
        transition: 'all 0.15s',
      }}
      onMouseOver={e => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(149, 192, 149, 0.03)';
      }}
      onMouseOut={e => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ marginRight: '8px', color: !success ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
          {!success ? '⚠' : '📄'}
        </span>
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          textShadow: isSelected ? '0 0 5px rgba(178, 250, 158, 0.3)' : 'none'
        }}>
          {node.name}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isDirty && (
          <span 
            title="Modified" 
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: 'var(--warning-color)',
              borderRadius: '50%',
              boxShadow: '0 0 5px var(--warning-color)'
            }}
          />
        )}
        {!success && (
          <span 
            title={node.config?.error || "Error parsing"}
            style={{
              fontSize: '10px',
              color: 'var(--danger-color)',
              fontWeight: 'bold',
              border: '1px solid var(--danger-color)',
              padding: '0 2px',
              borderRadius: '2px'
            }}
          >
            ERR
          </span>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ configs, selectedFilePath, onSelectFile, dirtyFiles }) {
  const [searchQuery, setSearchQuery] = useState('');

  const paths = Object.keys(configs);
  const tree = buildTree(paths, configs, searchQuery);
  
  const childrenKeys = Object.keys(tree.children);
  // Sort main groups
  childrenKeys.sort((a, b) => {
    const nodeA = tree.children[a];
    const nodeB = tree.children[b];
    if (nodeA.isDirectory && !nodeB.isDirectory) return -1;
    if (!nodeA.isDirectory && nodeB.isDirectory) return 1;
    return a.localeCompare(b);
  });

  return (
    <aside className="sidebar">
      {/* Search HUD */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
        <div style={{ 
          fontSize: '10px', 
          color: 'var(--text-secondary)', 
          marginBottom: '6px', 
          letterSpacing: '2px', 
          textTransform: 'uppercase',
          fontWeight: 'bold'
        }}>
          // FILTER_CONFIGS
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="ENTER SEARCH QUERY..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              fontSize: '12px',
              paddingLeft: '28px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)'
            }}
          />
          <span style={{
            position: 'absolute',
            left: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)',
            fontSize: '12px'
          }}>
            ▶
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ×
            </button>
          )}
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '10px', 
          fontSize: '10px', 
          color: 'var(--text-secondary)' 
        }}>
          <span>TOTAL: {paths.length} FILES</span>
          {dirtyFiles.size > 0 && (
            <span style={{ color: 'var(--warning-color)' }}>{dirtyFiles.size} MODIFIED</span>
          )}
        </div>
      </div>

      {/* Scrollable File List */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-secondary)' }}>
        {childrenKeys.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
            NO CONFIGS MATCHING QUERY
          </div>
        ) : (
          childrenKeys.map(key => (
            <FileTreeNode
              key={tree.children[key].path || tree.children[key].name}
              node={tree.children[key]}
              level={0}
              selectedPath={selectedFilePath}
              onSelectFile={onSelectFile}
              dirtyFiles={dirtyFiles}
            />
          ))
        )}
      </div>
    </aside>
  );
}
