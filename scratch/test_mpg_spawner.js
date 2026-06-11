const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Path to MPGSpawnerEditor.jsx
const filePath = path.join(__dirname, '..', 'src', 'components', 'MPGSpawnerEditor.jsx');
const content = fs.readFileSync(filePath, 'utf8');

// Helper to extract function body from JSX file using simple string matching
function extractFunction(name) {
    const startIdx = content.indexOf(`function ${name}(`);
    if (startIdx === -1) throw new Error(`Function ${name} not found`);
    
    // Find matching braces
    let braceCount = 0;
    let endIdx = -1;
    let foundStartBrace = false;
    
    for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            foundStartBrace = true;
        } else if (content[i] === '}') {
            braceCount--;
            if (foundStartBrace && braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }
    
    if (endIdx === -1) throw new Error(`Failed to find closing brace for ${name}`);
    const code = content.substring(startIdx, endIdx + 1);
    // Convert ES6 export or JSX elements if any (not present in these helper functions)
    return code;
}

console.log('Extracting MPG Spawner helper functions...');
const parseCode = extractFunction('parseSpawnListEntry');
const formatCode = extractFunction('formatSpawnListEntry');
const validateCode = extractFunction('validateTrigger');

// Evaluate them in a safe context
const parseSpawnListEntry = new Function(`return (${parseCode.replace('function parseSpawnListEntry', '')})`)();
const formatSpawnListEntry = new Function(`return (${formatCode.replace('function formatSpawnListEntry', '')})`)();
const validateTrigger = new Function(`return (${validateCode.replace('function validateTrigger', '')})`)();

console.log('Starting Unit Tests for MPG Spawner logic...');

// Test 1: parseSpawnListEntry
console.log('1. Testing parseSpawnListEntry...');
const testStr1 = 'ZmbM_JournalistNormal|0.8|300|5|0.5|2';
const parsed1 = parseSpawnListEntry(testStr1);
assert.strictEqual(parsed1.className, 'ZmbM_JournalistNormal');
assert.strictEqual(parsed1.chance, '0.8');
assert.strictEqual(parsed1.lifetime, '300');
assert.strictEqual(parsed1.count, '5');
assert.strictEqual(parsed1.health, '0.5');
assert.strictEqual(parsed1.foodStage, '2');

const testStr2 = 'ZmbF_MechanicNormal_Beige';
const parsed2 = parseSpawnListEntry(testStr2);
assert.strictEqual(parsed2.className, 'ZmbF_MechanicNormal_Beige');
assert.strictEqual(parsed2.chance, '');
assert.strictEqual(parsed2.lifetime, '');

console.log('   ✓ parseSpawnListEntry works.');

// Test 2: formatSpawnListEntry
console.log('2. Testing formatSpawnListEntry...');
const obj1 = {
    className: 'ZmbM_JournalistNormal',
    chance: '0.8',
    lifetime: '300',
    count: '5',
    health: '0.5',
    foodStage: '2'
};
assert.strictEqual(formatSpawnListEntry(obj1), 'ZmbM_JournalistNormal|0.8|300|5|0.5|2');

// Should strip trailing -3 defaults
const obj2 = {
    className: 'ZmbF_MechanicNormal_Beige',
    chance: '-3',
    lifetime: '-3',
    count: '-3',
    health: '-3',
    foodStage: '-3'
};
assert.strictEqual(formatSpawnListEntry(obj2), 'ZmbF_MechanicNormal_Beige');

const obj3 = {
    className: 'ZmbF_MechanicNormal_Beige',
    chance: '0.5',
    lifetime: '-3',
    count: '2',
    health: '-3',
    foodStage: '-3'
};
assert.strictEqual(formatSpawnListEntry(obj3), 'ZmbF_MechanicNormal_Beige|0.5|-3|2');

console.log('   ✓ formatSpawnListEntry works.');

// Test 3: validateTrigger
console.log('3. Testing validateTrigger...');

// Test normal trigger (no warnings)
const normalTrigger = {
    pointId: 1,
    triggerRadius: '50.0',
    spawnList: ['ZmbM_JournalistNormal'],
    triggerDependencies: []
};
const warnings1 = validateTrigger(normalTrigger, [normalTrigger], 'en');
assert.strictEqual(warnings1.length, 0, 'Should have no warnings for normal trigger');

// Test empty spawn list warning
const emptyTrigger = {
    pointId: 1,
    triggerRadius: '50.0',
    spawnList: [],
    triggerDependencies: []
};
const warnings2 = validateTrigger(emptyTrigger, [emptyTrigger], 'en');
assert.deepStrictEqual(warnings2, [{ code: 'EMPTY_SPAWN', message: 'Spawn list is empty' }]);

// Test zero dimensions warning
const zeroDimTrigger = {
    pointId: 1,
    triggerRadius: '0',
    triggerHeight: '',
    triggerWidthX: '0',
    triggerWidthY: '0.0',
    spawnList: ['ZmbM_JournalistNormal'],
    triggerDependencies: []
};
const warnings3 = validateTrigger(zeroDimTrigger, [zeroDimTrigger], 'en');
assert.deepStrictEqual(warnings3, [{ code: 'ZERO_DIMENSIONS', message: 'All trigger dimensions are 0 (will not activate)' }]);

// Test duplicate pointId warning
const triggerA = { pointId: 5, triggerRadius: '10', spawnList: ['A'] };
const triggerB = { pointId: 5, triggerRadius: '10', spawnList: ['B'] };
const warnings4 = validateTrigger(triggerA, [triggerA, triggerB], 'en');
assert.deepStrictEqual(warnings4, [{ code: 'DUPLICATE_ID', message: 'Duplicate trigger ID #5' }]);

// Test invalid dependency target warning
const dependentTrigger = {
    pointId: 2,
    triggerRadius: '10',
    spawnList: ['A'],
    triggerDependencies: [99] // Non-existent trigger ID
};
const warnings5 = validateTrigger(dependentTrigger, [dependentTrigger], 'en');
assert.deepStrictEqual(warnings5, [{ code: 'INVALID_LINK', message: 'Linked trigger #99 (Dependencies) does not exist' }]);

console.log('   ✓ validateTrigger warnings are correct.');

console.log('\n=== ALL UNIT TESTS FOR MPG SPAWNER LOGIC PASSED SUCCESSFULLY ===');
