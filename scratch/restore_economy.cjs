const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOG_PATH = path.join('C:', 'Users', 'Aves', '.gemini', 'antigravity', 'brain', '380d445f-fac7-42ce-a74f-70e510ee4bc0', '.system_generated', 'logs', 'transcript.jsonl');
const TARGET_FILE = path.resolve(__dirname, '..', 'src', 'components', 'EconomyEditor.jsx');

console.log('Restoring EconomyEditor.jsx to commit ae27fcd...');
execSync(`git checkout ae27fcd -- "${TARGET_FILE}"`, { stdio: 'inherit' });

console.log('Reading transcript.jsonl...');
const logLines = fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean);

// Define steps in order of execution
const stepsToReplay = [
  // Overview & Attachments feature pack (first half of the day)
  10370, 10376, 10382, 10386, 10390, 10398, 10404, 10410, 10414, 10418,
  // Usability & UX improvements pack (second half of the day)
  10520, 10526, 10534, 10540, 10548, 10552, 10558, 10588, 10602,
  // uiMode & Help legend pack (current session)
  10688, 10694, 10700, 10706, 10724, 10732, 10736, 10740, 10744, 10748, 10802
];

const stepsMap = new Map();
stepsToReplay.forEach(s => stepsMap.set(s, []));

logLines.forEach(line => {
  try {
    const obj = JSON.parse(line);
    if (stepsMap.has(obj.step_index)) {
      if (obj.tool_calls && obj.tool_calls.length > 0) {
        obj.tool_calls.forEach(tc => {
          if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content' || tc.name === 'replace_file_content_no_permission') {
            const file = tc.args.TargetFile;
            if (file && file.toLowerCase().includes('economyeditor.jsx') && file.toLowerCase().includes('online-editor')) {
              stepsMap.get(obj.step_index).push({
                name: tc.name,
                args: tc.args
              });
            }
          }
        });
      }
    }
  } catch (e) {
    // Ignore
  }
});

let fileContent = fs.readFileSync(TARGET_FILE, 'utf8');

function unescapeString(str) {
  if (typeof str !== 'string') return str;
  let s = str.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      return JSON.parse(s);
    } catch (e) {
      // Fallback if not valid JSON string representation
      return s.slice(1, -1).replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    }
  }
  return str.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

function replaceFlexible(content, target, replacement, stepIndex) {
  target = unescapeString(target);
  replacement = unescapeString(replacement);

  const contentLines = content.replace(/\r\n/g, '\n').split('\n');
  const targetLines = target.replace(/\r\n/g, '\n').split('\n').map(s => s.trim());
  const replacementLines = replacement.replace(/\r\n/g, '\n').split('\n');

  let foundIdx = -1;
  for (let i = 0; i <= contentLines.length - targetLines.length; i++) {
    let match = true;
    for (let j = 0; j < targetLines.length; j++) {
      const cLineClean = contentLines[i + j].trim();
      const tLineClean = targetLines[j];
      if (cLineClean !== tLineClean) {
        match = false;
        break;
      }
    }
    if (match) {
      foundIdx = i;
      break;
    }
  }

  if (foundIdx === -1) {
    console.log(`\n--- DEBUG step ${stepIndex} ---`);
    console.log(`Target first line to find: "${targetLines[0]}"`);
    console.log(`Target lines count: ${targetLines.length}`);
    
    // Find lines in file containing part of target
    const partialMatch = targetLines[0].substring(0, Math.min(30, targetLines[0].length));
    console.log(`Looking in file for lines containing: "${partialMatch}"`);
    contentLines.forEach((line, idx) => {
      if (line.includes(partialMatch)) {
        console.log(`Line ${idx + 1}: "${line.trim()}"`);
        for (let k = 0; k < Math.min(5, targetLines.length); k++) {
          if (contentLines[idx + k]) {
            console.log(`  +${k}: file="${contentLines[idx+k].trim()}" vs target="${targetLines[k] || ''}"`);
          }
        }
      }
    });
    return null;
  }

  contentLines.splice(foundIdx, targetLines.length, ...replacementLines);
  return contentLines.join('\n');
}

for (const stepIndex of stepsToReplay) {
  const actions = stepsMap.get(stepIndex);
  if (!actions || actions.length === 0) {
    console.log(`[Step ${stepIndex}] No actions found, skipping.`);
    continue;
  }

  console.log(`[Step ${stepIndex}] Replaying ${actions.length} action(s)...`);
  for (const action of actions) {
    if (action.name === 'replace_file_content') {
      const { TargetContent, ReplacementContent } = action.args;
      const result = replaceFlexible(fileContent, TargetContent, ReplacementContent, stepIndex);
      
      if (result === null) {
        console.error(`ERROR at step ${stepIndex}: Target content not found!`);
        fs.writeFileSync(TARGET_FILE + '.err', fileContent, 'utf8');
        process.exit(1);
      }
      fileContent = result;
    } else if (action.name === 'multi_replace_file_content') {
      const chunks = action.args.ReplacementChunks;
      for (const chunk of chunks) {
        const result = replaceFlexible(fileContent, chunk.TargetContent, chunk.ReplacementContent, stepIndex);
        if (result === null) {
          console.error(`ERROR at step ${stepIndex} (multi): Target chunk not found!`);
          fs.writeFileSync(TARGET_FILE + '.err', fileContent, 'utf8');
          process.exit(1);
        }
        fileContent = result;
      }
    }
  }
}

// Convert back to original platform-dependent line endings (Windows CRLF)
fileContent = fileContent.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n');

fs.writeFileSync(TARGET_FILE, fileContent, 'utf8');
console.log('SUCCESS: EconomyEditor.jsx has been completely restored!');
