const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Absolute paths to MPG Spawner files on disk
const workspaceRoot = path.join(__dirname, '..', '..');
const configPath = path.join(workspaceRoot, 'MPG_Spawner', 'Config.json');
const point1Path = path.join(workspaceRoot, 'MPG_Spawner', 'Points', 'Point_Example1.json');

// Extract MPG Spawner helper functions from MPGSpawnerEditor.jsx
const spawnerEditorPath = path.join(__dirname, '..', 'src', 'components', 'MPGSpawnerEditor.jsx');
const spawnerContent = fs.readFileSync(spawnerEditorPath, 'utf8');

function extractFunction(name) {
    const startIdx = spawnerContent.indexOf(`function ${name}(`);
    if (startIdx === -1) throw new Error(`Function ${name} not found`);
    
    let braceCount = 0;
    let endIdx = -1;
    let foundStartBrace = false;
    
    for (let i = startIdx; i < spawnerContent.length; i++) {
        if (spawnerContent[i] === '{') {
            braceCount++;
            foundStartBrace = true;
        } else if (spawnerContent[i] === '}') {
            braceCount--;
            if (foundStartBrace && braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }
    
    if (endIdx === -1) throw new Error(`Failed to find closing brace for ${name}`);
    return spawnerContent.substring(startIdx, endIdx + 1);
}

const parseCode = extractFunction('parseSpawnListEntry');
const formatCode = extractFunction('formatSpawnListEntry');
const validateCode = extractFunction('validateTrigger');

eval(parseCode);
eval(formatCode);
eval(validateCode);

console.log('=== STARTING MPG SPAWNER FS INTEGRATION TEST ===');

try {
    // 1. Verify files exist
    console.log('1. Checking file existence on disk...');
    assert(fs.existsSync(configPath), 'Config.json is missing');
    assert(fs.existsSync(point1Path), 'Point_Example1.json is missing');
    console.log('   ✓ Spawner files exist.');

    // 2. Read and parse Config.json
    console.log('2. Reading and parsing Config.json...');
    const configRaw = fs.readFileSync(configPath, 'utf8');
    const configData = JSON.parse(configRaw);
    assert.strictEqual(configData.configVersion, 4);
    assert(configData.pointsConfigs.includes('Point_Example1'));
    console.log('   ✓ Config.json contains correct version and points list.');

    // 3. Read and parse Point_Example1.json
    console.log('3. Reading and parsing Point_Example1.json...');
    const point1Raw = fs.readFileSync(point1Path, 'utf8');
    const point1Data = JSON.parse(point1Raw);
    assert(Array.isArray(point1Data), 'Points file should be an array of triggers');
    assert.strictEqual(point1Data.length, 2);
    
    const trigger1 = point1Data[0];
    assert.strictEqual(trigger1.pointId, 1);
    assert.strictEqual(trigger1.notificationTitle, 'Точка 1');
    console.log(`   ✓ Found ${point1Data.length} trigger points. Trigger 1 ID is correct.`);

    // 4. Validate triggers
    console.log('4. Validating trigger configurations...');
    point1Data.forEach(trigger => {
        const warnings = validateTrigger(trigger, point1Data, 'ru');
        console.log(`   * Trigger #${trigger.pointId} Warnings:`, warnings);
        assert.strictEqual(warnings.length, 0, `Trigger #${trigger.pointId} should have no warnings`);
    });
    console.log('   ✓ Verification of all points passed with 0 warnings.');

    // 5. Simulate modification and save back to disk
    console.log('5. Simulating modification of Trigger 1 name...');
    const originalName = trigger1.notificationTitle;
    const testName = 'Точка 1 (Тестовая модификация)';
    trigger1.notificationTitle = testName;

    // Simulate formatting spawn list entries back
    if (trigger1.spawnList) {
        trigger1.spawnList = trigger1.spawnList.map(entry => {
            const parsed = parseSpawnListEntry(entry);
            return formatSpawnListEntry(parsed);
        });
    }

    console.log('   * Writing updated content to Point_Example1.json...');
    fs.writeFileSync(point1Path, JSON.stringify(point1Data, null, 4), 'utf8');

    // 6. Reload from disk and verify change was written correctly
    console.log('6. Reloading file from disk and verifying modification...');
    const point1ReloadRaw = fs.readFileSync(point1Path, 'utf8');
    const point1ReloadData = JSON.parse(point1ReloadRaw);
    assert.strictEqual(point1ReloadData[0].notificationTitle, testName, 'Trigger name was not saved correctly');
    console.log('   ✓ Modification was successfully written and verified on disk.');

    // 7. Revert change to original state
    console.log('7. Reverting Point_Example1.json to original name...');
    point1ReloadData[0].notificationTitle = originalName;
    fs.writeFileSync(point1Path, JSON.stringify(point1ReloadData, null, 4), 'utf8');
    
    const finalReloadRaw = fs.readFileSync(point1Path, 'utf8');
    const finalReloadData = JSON.parse(finalReloadRaw);
    assert.strictEqual(finalReloadData[0].notificationTitle, originalName, 'Failed to revert original name');
    console.log('   ✓ File successfully restored to original state.');

    console.log('\n=== MPG SPAWNER FS INTEGRATION TEST PASSED SUCCESSFULLY ===');

} catch (e) {
    console.error('\n❌ FS INTEGRATION TEST FAILED:');
    console.error(e);
    process.exit(1);
}
