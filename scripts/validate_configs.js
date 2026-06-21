import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanJsonComments } from '../src/utils/diagnostics.js';

// Setup __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Whitelist of root folders to scan
const WHITELIST_FOLDERS = ['expansion', 'expansionmod', 'mpg_spawner', 'searchforloot'];
const EXCLUDE_FOLDERS = ['node_modules', '.git', 'dist', 'public', 'backups', '.pz_tool'];

// Item-related keys that contain classnames or lists of classnames
const ITEM_KEYS = new Set([
  'classname', 'class_name', 'item', 'itemname', 'item_name', 'itemclass',
  'primaryweapon', 'secondaryweapon', 'backpack', 'vest', 'body', 'hips',
  'feet', 'gloves', 'headgear', 'mask', 'eyewear', 'hands', 'lefthand', 'righthand',
  'weapon', 'magazine'
]);

const ITEM_ARRAY_KEYS = new Set([
  'loot', 'items', 'spawnitems', 'attachments', 'magazines', 'weapons'
]);

// Helper to check if a directory/file is whitelisted
function isWhitelistedPath(filePath, rootDir) {
  const relative = path.relative(rootDir, filePath);
  const parts = relative.split(path.sep);
  if (parts.length === 0) return false;
  
  // Check if first part or second part (if inside JSON folder) matches whitelist
  const firstPart = parts[0].toLowerCase();
  if (WHITELIST_FOLDERS.includes(firstPart)) {
    return true;
  }
  
  if (firstPart === 'json' && parts.length > 1) {
    const secondPart = parts[1].toLowerCase();
    if (WHITELIST_FOLDERS.includes(secondPart)) {
      return true;
    }
  }
  
  return false;
}

// Helper to check if a directory should be skipped
function shouldSkipDirectory(dirName) {
  return EXCLUDE_FOLDERS.includes(dirName.toLowerCase());
}

// Find all JSON and XML files in the target directory
function findFiles(dir, allJson = [], allXml = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return { allJson, allXml };
  }
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      findFiles(fullPath, allJson, allXml);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.json') {
        allJson.push(fullPath);
      } else if (ext === '.xml') {
        allXml.push(fullPath);
      }
    }
  }
  return { allJson, allXml };
}

// Parse xml items using the fast regex parser matching the client
function parseXmlItems(xmlPath) {
  try {
    const text = fs.readFileSync(xmlPath, 'utf8');
    const cleanText = text.replace(/<!--[\s\S]*?-->/g, '');
    const regex = /<type\s+name=["']([^"']+)["']/g;
    const items = [];
    let match;
    while ((match = regex.exec(cleanText)) !== null) {
      if (match[1]) {
        items.push(match[1].toLowerCase());
      }
    }
    return items;
  } catch (e) {
    console.error(`Failed to parse XML file ${xmlPath}: ${e.message}`);
    return [];
  }
}

// Traverse JSON object and find item references
function checkJsonItems(obj, typesDb, missingItemsList, currentKey = '', parentKey = '') {
  if (typeof obj === 'string') {
    const cleanedVal = obj.trim();
    if (!cleanedVal) return;
    
    // Check if the current value is under an item key, or in an item array
    const isItemKey = ITEM_KEYS.has(currentKey.toLowerCase());
    const isItemArray = ITEM_ARRAY_KEYS.has(parentKey.toLowerCase());
    
    if (isItemKey || isItemArray) {
      if (!typesDb.has(cleanedVal.toLowerCase())) {
        missingItemsList.add(cleanedVal);
      }
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      checkJsonItems(item, typesDb, missingItemsList, '', currentKey);
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      checkJsonItems(val, typesDb, missingItemsList, key, currentKey);
    }
  }
}

// Main execution
function main() {
  const rootDir = path.resolve(__dirname, '..');
  console.log(`Scanning DayZ configs in: ${rootDir}`);
  
  const { allJson, allXml } = findFiles(rootDir);
  
  // Whitelist filter for JSON files
  const targetJsonFiles = allJson.filter(f => isWhitelistedPath(f, rootDir));
  
  console.log(`Found ${targetJsonFiles.length} JSON configuration files to validate.`);
  
  // Build Types DB from all found XML files
  const typesDb = new Set();
  if (allXml.length > 0) {
    console.log(`Found ${allXml.length} XML file(s). Extracting item classnames...`);
    for (const xmlFile of allXml) {
      const parsedItems = parseXmlItems(xmlFile);
      parsedItems.forEach(item => typesDb.add(item));
    }
    console.log(`Loaded ${typesDb.size} unique item classnames into the database.`);
  } else {
    console.log('⚠️ No XML files (like types.xml) found. Item reference validation will be skipped (only format/syntax check will run).');
  }
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const jsonPath of targetJsonFiles) {
    const relativePath = path.relative(rootDir, jsonPath);
    try {
      const rawText = fs.readFileSync(jsonPath, 'utf8');
      const cleanText = cleanJsonComments(rawText);
      const content = JSON.parse(cleanText);
      
      console.log(`✅ ${relativePath}: JSON format valid`);
      
      // If we have a types database, check for missing items
      if (typesDb.size > 0) {
        const missingItems = new Set();
        checkJsonItems(content, typesDb, missingItems);
        if (missingItems.size > 0) {
          console.log(`   ⚠️ Warnings for ${relativePath}:`);
          for (const item of missingItems) {
            console.log(`     - Item "${item}" not found in XML database.`);
            totalWarnings++;
          }
        }
      }
    } catch (e) {
      console.error(`❌ ${relativePath}: JSON parsing failed: ${e.message}`);
      totalErrors++;
    }
  }
  
  console.log('\n--- Validation Summary ---');
  console.log(`JSON Files Checked: ${targetJsonFiles.length}`);
  console.log(`XML Database Size: ${typesDb.size} items`);
  console.log(`Errors (Syntax/Parsing): ${totalErrors}`);
  console.log(`Warnings (Missing items): ${totalWarnings}`);
  
  if (totalErrors > 0) {
    process.exit(1);
  }
}

main();
