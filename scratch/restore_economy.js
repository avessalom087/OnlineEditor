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
            // Check if it targets our file
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
    // Ignore malformed json
  }
});

let fileContent = fs.readFileSync(TARGET_FILE, 'utf8');

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
      
      // Normalize line endings to avoid replacement issues
      const normalizedContent = fileContent.replace(/\r\n/g, '\n');
      const normalizedTarget = TargetContent.replace(/\r\n/g, '\n');
      const normalizedReplacement = ReplacementContent.replace(/\r\n/g, '\n');

      if (!normalizedContent.includes(normalizedTarget)) {
        console.error(`ERROR at step ${stepIndex}: Target content not found!`);
        // Save temporary file state to debug
        fs.writeFileSync(TARGET_FILE + '.err', fileContent, 'utf8');
        process.exit(1);
      }

      fileContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
    } else if (action.name === 'multi_replace_file_content') {
      const chunks = action.args.ReplacementChunks;
      let normalizedContent = fileContent.replace(/\r\n/g, '\n');

      for (const chunk of chunks) {
        const normalizedTarget = chunk.TargetContent.replace(/\r\n/g, '\n');
        const normalizedReplacement = chunk.ReplacementContent.replace(/\r\n/g, '\n');

        if (!normalizedContent.includes(normalizedTarget)) {
          console.error(`ERROR at step ${stepIndex} (multi): Target chunk not found!`);
          fs.writeFileSync(TARGET_FILE + '.err', fileContent, 'utf8');
          process.exit(1);
        }

        normalizedContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
      }
      fileContent = normalizedContent;
    }
  }
}

// Convert back to original platform-dependent line endings (Windows CRLF)
fileContent = fileContent.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n');

fs.writeFileSync(TARGET_FILE, fileContent, 'utf8');
console.log('SUCCESS: EconomyEditor.jsx has been completely restored!');
