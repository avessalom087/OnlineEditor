import { cleanJsonComments } from '../utils/diagnostics';

let activeDirHandle = null;

/**
 * Sets the active directory handle.
 * @param {FileSystemDirectoryHandle} handle 
 */
export function setDirectoryHandle(handle) {
  activeDirHandle = handle;
}

/**
 * Gets the active directory handle.
 * @returns {FileSystemDirectoryHandle|null}
 */
export function getDirectoryHandle() {
  return activeDirHandle;
}

/**
 * Checks if the application has a directory loaded.
 * @returns {boolean}
 */
export function hasDirectoryAccess() {
  return activeDirHandle !== null;
}

/**
 * Verifies and requests read/write permissions for a directory handle.
 * @param {FileSystemDirectoryHandle} handle 
 * @param {string} mode 'read' or 'readwrite'
 * @returns {Promise<boolean>}
 */
export async function verifyPermission(handle, mode = 'readwrite') {
  if (!handle) return false;
  const options = { mode };
  // Check if permission was already granted
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  // Request permission
  if ((await handle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}

/**
 * Navigates to a file path within a root handle, optionally creating it.
 * @param {FileSystemDirectoryHandle} rootHandle 
 * @param {string} pathStr relative path (e.g. 'expansion/settings/BookSettings.json')
 * @param {object} options { create: boolean }
 * @returns {Promise<FileSystemFileHandle>}
 */
async function getFileHandleFromPath(rootHandle, pathStr, options = { create: false }) {
  const parts = pathStr.split('/');
  let currentHandle = rootHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: options.create });
  }
  return await currentHandle.getFileHandle(parts[parts.length - 1], { create: options.create });
}

/**
 * Scans a folder recursively, loading JSON configurations.
 */
async function scanDir(dirHandle, pathArray = [], configs = {}) {
  for await (const entry of dirHandle.values()) {
    const currentPath = [...pathArray, entry.name];
    if (entry.kind === 'directory') {
      // Skip the backups directory during scanning
      if (currentPath.length === 1 && (entry.name.toLowerCase() === '.pz_tool' || entry.name.toLowerCase() === 'backups')) {
        continue;
      }
      await scanDir(entry, currentPath, configs);
    } else if (entry.kind === 'file') {
      const relPath = currentPath.join('/');
      const rootLower = currentPath[0].toLowerCase();
      const isConfigPath = rootLower === 'expansion' || rootLower === 'expansionmod' || rootLower === 'mpg_spawner';
      
      if (isConfigPath && entry.name.toLowerCase().endsWith('.json')) {
        try {
          const file = await entry.getFile();
          const rawText = await file.text();
          const cleanText = cleanJsonComments(rawText);
          const content = JSON.parse(cleanText);
          configs[relPath] = {
            success: true,
            content,
            sizeBytes: file.size
          };
        } catch (e) {
          configs[relPath] = {
            success: false,
            error: e.message,
            sizeBytes: 0
          };
        }
      }
    }
  }
}

/**
 * Reads all configuration files in the opened directory.
 * @returns {Promise<{ configs: object, schemaReport: object|null }>}
 */
export async function getConfigs() {
  if (!activeDirHandle) {
    throw new Error('No directory selected');
  }

  const configs = {};
  let schemaReport = null;

  // 1. Scan for schema_report.json in root
  try {
    const schemaHandle = await activeDirHandle.getFileHandle('schema_report.json');
    const file = await schemaHandle.getFile();
    const text = await file.text();
    schemaReport = JSON.parse(text);
  } catch (e) {
    // Ignore if not present
  }

  // 2. Scan folders recursively
  // We can scan expansion and ExpansionMod if they exist
  let hasExpansion = false;
  let hasExpansionMod = false;
  let hasMpgSpawner = false;

  for await (const entry of activeDirHandle.values()) {
    if (entry.kind === 'directory') {
      if (entry.name.toLowerCase() === 'expansion') {
        hasExpansion = true;
        await scanDir(entry, ['expansion'], configs);
      } else if (entry.name.toLowerCase() === 'expansionmod') {
        hasExpansionMod = true;
        await scanDir(entry, ['ExpansionMod'], configs);
      } else if (entry.name.toLowerCase() === 'mpg_spawner') {
        hasMpgSpawner = true;
        await scanDir(entry, ['MPG_Spawner'], configs);
      }
    }
  }

  // Fallback: What if they opened expansion/ or ExpansionMod/ directly?
  if (!hasExpansion && !hasExpansionMod) {
    // Check if the current folder itself looks like a mod folder directly (has settings/traders or Quests/AI)
    let looksLikeModDir = false;
    for await (const entry of activeDirHandle.values()) {
      if (entry.kind === 'directory' && ['settings', 'traders', 'quests', 'ai', 'market', 'loadouts', 'points'].includes(entry.name.toLowerCase())) {
        looksLikeModDir = true;
        break;
      }
    }

    if (looksLikeModDir) {
      // We will read this folder directly as the root config folder.
      // We prefix relative paths based on what folders exist.
      // But to keep it simple and aligned, we scan and let scanDir resolve them, 
      // mapping relative paths relative to activeDirHandle as-is.
      for await (const entry of activeDirHandle.values()) {
        if (entry.kind === 'directory' && entry.name.toLowerCase() !== 'backups') {
          await scanDir(entry, [entry.name], configs);
        }
      }
    }
  }

  return { configs, schemaReport };
}

/**
 * Copies a source file to a target backup directory.
 */
async function backupFile(rootDirHandle, backupFolderHandle, filePath) {
  try {
    const fileHandle = await getFileHandleFromPath(rootDirHandle, filePath);
    const file = await fileHandle.getFile();
    
    const parts = filePath.split('/');
    let currentHandle = backupFolderHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
    }
    
    const destFileHandle = await currentHandle.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await destFileHandle.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
  } catch (err) {
    // If the file does not exist yet (e.g. creating a new config), no backup is needed
    if (err.name !== 'NotFoundError') {
      console.error(`[BACKUP ERROR] Failed to backup ${filePath}:`, err);
    }
  }
}

/**
 * Rotates backups: keeps max 3, deletes folders older than 72 hours.
 */
async function rotateBackups(rootDirHandle) {
  try {
    let backupsDirHandle;
    try {
      const pzToolDirHandle = await rootDirHandle.getDirectoryHandle('.pz_tool');
      backupsDirHandle = await pzToolDirHandle.getDirectoryHandle('backups');
    } catch (e) {
      return;
    }
    
    const folders = [];
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    
    for await (const entry of backupsDirHandle.values()) {
      if (entry.kind === 'directory' && (entry.name.startsWith('backup_file_') || entry.name.startsWith('backup_all_'))) {
        const parts = entry.name.split('_');
        const timestamp = parseInt(parts[2], 10);
        // Guard: skip entries where timestamp is not a valid positive number
        // (e.g. manually created folders like "backup_all_0" or "backup_all_abc")
        if (!isNaN(timestamp) && timestamp > 0) {
          if (timestamp < threeDaysAgo) {
            await backupsDirHandle.removeEntry(entry.name, { recursive: true });
            console.log(`[BACKUP ROTATION] Deleted backup older than 3 days: ${entry.name}`);
            continue;
          }
          folders.push({
            name: entry.name,
            timestamp: timestamp
          });
        }
      }
    }
    
    folders.sort((a, b) => a.timestamp - b.timestamp); // oldest first
    
    const maxBackups = 3;
    if (folders.length > maxBackups) {
      const toDelete = folders.slice(0, folders.length - maxBackups);
      for (const folder of toDelete) {
        await backupsDirHandle.removeEntry(folder.name, { recursive: true });
        console.log(`[BACKUP ROTATION] Deleted old backup folder (limit 3 exceeded): ${folder.name}`);
      }
    }
  } catch (err) {
    console.error('[BACKUP ROTATION ERROR] Failed to rotate backups:', err);
  }
}

/**
 * Saves a single configuration file with automated backup.
 * @param {string} filePath 
 * @param {object} content 
 * @returns {Promise<boolean>}
 */
export async function saveFile(filePath, content) {
  if (!activeDirHandle) throw new Error('No directory selected');

  const timestamp = Date.now();
  const pzToolDirHandle = await activeDirHandle.getDirectoryHandle('.pz_tool', { create: true });
  const backupsDirHandle = await pzToolDirHandle.getDirectoryHandle('backups', { create: true });
  const backupFolderHandle = await backupsDirHandle.getDirectoryHandle(`backup_file_${timestamp}`, { create: true });

  // Backup the file first if it exists
  await backupFile(activeDirHandle, backupFolderHandle, filePath);

  // Write new content
  const fileHandle = await getFileHandleFromPath(activeDirHandle, filePath, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(content, null, 4));
  await writable.close();

  // Rotate old backups
  await rotateBackups(activeDirHandle);

  return true;
}

/**
 * Saves multiple configuration files (package export).
 * @param {Array<{ filePath: string, content: object }>} files 
 * @returns {Promise<boolean>}
 */
export async function saveAll(files) {
  if (!activeDirHandle) throw new Error('No directory selected');

  const timestamp = Date.now();
  const pzToolDirHandle = await activeDirHandle.getDirectoryHandle('.pz_tool', { create: true });
  const backupsDirHandle = await pzToolDirHandle.getDirectoryHandle('backups', { create: true });
  const backupFolderHandle = await backupsDirHandle.getDirectoryHandle(`backup_all_${timestamp}`, { create: true });

  for (const file of files) {
    // Backup the file first if it exists
    await backupFile(activeDirHandle, backupFolderHandle, file.filePath);

    // Write new content
    const fileHandle = await getFileHandleFromPath(activeDirHandle, file.filePath, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(file.content, null, 4));
    await writable.close();
  }

  // Rotate old backups
  await rotateBackups(activeDirHandle);

  return true;
}

/**
 * Deletes a configuration file from disk.
 * @param {string} filePath 
 * @returns {Promise<boolean>}
 */
export async function deleteFile(filePath) {
  if (!activeDirHandle) throw new Error('No directory selected');

  const parts = filePath.split('/');
  let currentHandle = activeDirHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
  }
  await currentHandle.removeEntry(parts[parts.length - 1]);

  return true;
}

/**
 * Cleans comments/commas, parses JSON, and saves as valid pretty JSON.
 * @param {string} filePath 
 * @returns {Promise<{ success: boolean, content: object }>}
 */
export async function fixSyntax(filePath) {
  if (!activeDirHandle) throw new Error('No directory selected');

  const fileHandle = await getFileHandleFromPath(activeDirHandle, filePath);
  const file = await fileHandle.getFile();
  const rawText = await file.text();
  const cleanText = cleanJsonComments(rawText);
  const parsed = JSON.parse(cleanText);

  // Save cleaned JSON back to disk
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(parsed, null, 4));
  await writable.close();

  return { success: true, content: parsed };
}

/**
 * Recursively scans a backup folder and lists all files inside it.
 */
async function collectFilesRecursively(dirHandle, pathArray = [], filesList = []) {
  for await (const entry of dirHandle.values()) {
    const currentPath = [...pathArray, entry.name];
    if (entry.kind === 'directory') {
      await collectFilesRecursively(entry, currentPath, filesList);
    } else if (entry.kind === 'file') {
      filesList.push(currentPath.join('/'));
    }
  }
}

/**
 * Returns a list of all backup folders, their creation dates, and files list.
 * @returns {Promise<Array>}
 */
export async function listBackups() {
  if (!activeDirHandle) return [];

  try {
    let backupsDirHandle;
    try {
      const pzToolDirHandle = await activeDirHandle.getDirectoryHandle('.pz_tool');
      backupsDirHandle = await pzToolDirHandle.getDirectoryHandle('backups');
    } catch (e) {
      return [];
    }

    const list = [];
    for await (const entry of backupsDirHandle.values()) {
      if (entry.kind === 'directory' && (entry.name.startsWith('backup_file_') || entry.name.startsWith('backup_all_'))) {
        const parts = entry.name.split('_');
        const timestamp = parseInt(parts[2], 10);
        if (!isNaN(timestamp)) {
          const filesList = [];
          await collectFilesRecursively(entry, [], filesList);
          list.push({
            name: entry.name,
            mtime: timestamp,
            files: filesList
          });
        }
      }
    }

    // Sort by mtime descending (newest first)
    list.sort((a, b) => b.mtime - a.mtime);
    return list;
  } catch (err) {
    console.error('Failed to list backups:', err);
    return [];
  }
}

/**
 * Restores a backup.
 */
async function copyFolderContent(srcDirHandle, destDirHandle) {
  for await (const entry of srcDirHandle.values()) {
    if (entry.kind === 'directory') {
      const newDestDir = await destDirHandle.getDirectoryHandle(entry.name, { create: true });
      await copyFolderContent(entry, newDestDir);
    } else if (entry.kind === 'file') {
      const file = await entry.getFile();
      const destFile = await destDirHandle.getFileHandle(entry.name, { create: true });
      const writable = await destFile.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
    }
  }
}

/**
 * Restores all files from a backup folder back into the root configuration directory.
 * @param {string} folderName 
 * @returns {Promise<boolean>}
 */
export async function restoreBackup(folderName) {
  if (!activeDirHandle) throw new Error('No directory selected');

  const pzToolDirHandle = await activeDirHandle.getDirectoryHandle('.pz_tool');
  const backupsDirHandle = await pzToolDirHandle.getDirectoryHandle('backups');
  const backupFolderHandle = await backupsDirHandle.getDirectoryHandle(folderName);

  await copyFolderContent(backupFolderHandle, activeDirHandle);
  console.log(`[BACKUP RESTORE] Successfully restored backup: ${folderName}`);
  
  return true;
}

/**
 * Reads settings from .pz_tool/settings.json if it exists.
 * @returns {Promise<object|null>}
 */
export async function getSettings() {
  if (!activeDirHandle) return null;
  try {
    const pzToolDirHandle = await activeDirHandle.getDirectoryHandle('.pz_tool');
    const settingsHandle = await pzToolDirHandle.getFileHandle('settings.json');
    const file = await settingsHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch (e) {
    return null; // Ignore if directory or file doesn't exist
  }
}

/**
 * Saves settings to .pz_tool/settings.json.
 * @param {object} settings 
 * @returns {Promise<boolean>}
 */
export async function saveSettings(settings) {
  if (!activeDirHandle) return false;
  try {
    const pzToolDirHandle = await activeDirHandle.getDirectoryHandle('.pz_tool', { create: true });
    const settingsHandle = await pzToolDirHandle.getFileHandle('settings.json', { create: true });
    
    let existing = {};
    try {
      const file = await settingsHandle.getFile();
      const text = await file.text();
      existing = JSON.parse(text);
    } catch (e) {}

    const merged = { ...existing, ...settings };

    const writable = await settingsHandle.createWritable();
    await writable.write(JSON.stringify(merged, null, 4));
    await writable.close();
    return true;
  } catch (e) {
    console.error('Failed to save settings:', e);
    return false;
  }
}

/**
 * Saves a custom map image file inside the .pz_tool directory.
 * @param {File} file 
 * @returns {Promise<boolean>}
 */
export async function saveCustomMap(file) {
  if (!activeDirHandle) return false;
  try {
    const pzToolDirHandle = await activeDirHandle.getDirectoryHandle('.pz_tool', { create: true });
    const extension = file.name.split('.').pop() || 'png';
    const fileName = `custom_map.${extension}`;
    const settings = await getSettings() || {};
    
    // Check if the exact same custom map is already saved to avoid duplicate writes
    if (settings.customMapPath === `.pz_tool/${fileName}`) {
      try {
        const existingHandle = await pzToolDirHandle.getFileHandle(fileName);
        const existingFile = await existingHandle.getFile();
        if (existingFile.size === file.size && existingFile.name === file.name) {
          console.log("[MAP PERSIST] Map is identical, skipping redundant write.");
          return true;
        }
      } catch (err) {}
    }
    
    // Remove any previous custom map file if format changed
    if (settings.customMapPath && settings.customMapPath !== `.pz_tool/${fileName}`) {
      try {
        const oldFile = settings.customMapPath.split('/').pop();
        await pzToolDirHandle.removeEntry(oldFile);
      } catch (err) {}
    }
    
    const mapFileHandle = await pzToolDirHandle.getFileHandle(fileName, { create: true });
    const writable = await mapFileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    
    settings.customMapPath = `.pz_tool/${fileName}`;
    await saveSettings(settings);
    return true;
  } catch (e) {
    console.error('Failed to save custom map:', e);
    return false;
  }
}

/**
 * Loads the custom map image file from the .pz_tool directory if registered in settings.
 * @returns {Promise<File|null>}
 */
export async function loadCustomMap() {
  if (!activeDirHandle) return null;
  try {
    const settings = await getSettings();
    if (!settings || !settings.customMapPath) return null;
    
    const pzToolDirHandle = await activeDirHandle.getDirectoryHandle('.pz_tool');
    const fileName = settings.customMapPath.split('/').pop();
    const mapFileHandle = await pzToolDirHandle.getFileHandle(fileName);
    return await mapFileHandle.getFile();
  } catch (e) {
    console.warn('Failed to load custom map from workspace:', e);
    return null;
  }
}

