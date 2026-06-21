import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to find the next Quest/Objective ID or use 9999 for test
const TEST_ID = 9999;

const OBJECTIVE_TYPES = {
  10: { folder: 'Action', prefix: 'A' },
  8: { folder: 'AICamp', prefix: 'AIC' },
  7: { folder: 'AIPatrol', prefix: 'AIP' },
  9: { folder: 'AIVIP', prefix: 'AIESCORT' },
  4: { folder: 'Collection', prefix: 'C' },
  11: { folder: 'Crafting', prefix: 'CR' },
  5: { folder: 'Delivery', prefix: 'D' },
  2: { folder: 'Target', prefix: 'TA' },
  3: { folder: 'Travel', prefix: 'T' },
  6: { folder: 'TreasureHunt', prefix: 'TH' }
};

// Generate Quest & Objective templates (copied from QuestGraph.jsx generator)
function generateQuestAndObjective(typeId, questTitle, objText, configPrefix = 'JSON/ExpansionMod/') {
  const info = OBJECTIVE_TYPES[typeId];
  if (!info) throw new Error(`Invalid objective type: ${typeId}`);

  // 1. Objective Content
  let objTemplate = {
    ConfigVersion: 28,
    ID: TEST_ID,
    ObjectiveType: Number(typeId),
    ObjectiveText: objText || `Complete objective #${TEST_ID}`,
    TimeLimit: -1,
    Active: 1
  };

  if (Number(typeId) === 3) { // Travel
    objTemplate = {
      ...objTemplate,
      Position: [1200.0, 150.0, 4500.0],
      MaxDistance: 20.0,
      MarkerName: "Test Travel Destination",
      ShowDistance: 1,
      TriggerOnEnter: 1,
      TriggerOnExit: 0
    };
  } else if (Number(typeId) === 5) { // Delivery
    objTemplate = {
      ...objTemplate,
      Collections: [
        {
          Amount: 5,
          ClassName: "M4A1",
          QuantityPercent: -1,
          MinQuantityPercent: -1
        }
      ],
      ShowDistance: 1,
      AddItemsToNearbyMarketZone: 0,
      MaxDistance: 20.0,
      MarkerName: "Test Delivery Target"
    };
  } else if (Number(typeId) === 2) { // Target (Kill)
    objTemplate = {
      ...objTemplate,
      Position: [0.0, 0.0, 0.0],
      MaxDistance: -1.0,
      MinDistance: -1.0,
      Amount: 10,
      ClassNames: ["Zombie"],
      CountSelfKill: 0,
      AllowedWeapons: [],
      ExcludedClassNames: [],
      CountAIPlayers: 0,
      AllowedTargetFactions: [],
      AllowedDamageZones: []
    };
  } else if (Number(typeId) === 4) { // Collection
    objTemplate = {
      ...objTemplate,
      Collections: [
        {
          Amount: 3,
          ClassName: "Apple",
          QuantityPercent: -1,
          MinQuantityPercent: -1
        }
      ],
      ShowDistance: 1,
      AddItemsToNearbyMarketZone: 0,
      NeedAnyCollection: 0
    };
  }

  // 2. Quest Content
  const questTemplate = {
    ConfigVersion: 22,
    ID: TEST_ID,
    Type: 1,
    Title: questTitle,
    Descriptions: [
      "Test start dialog",
      "Test progress description",
      "Test completion description"
    ],
    ObjectiveText: objText,
    FollowUpQuest: -1,
    Repeatable: 0,
    IsDailyQuest: 0,
    IsWeeklyQuest: 0,
    CancelQuestOnPlayerDeath: 0,
    Autocomplete: 0,
    IsGroupQuest: 0,
    ObjectSetFileName: "",
    QuestItems: [],
    Rewards: [
      { ClassName: "SodaCan_Cola", Amount: 2 }
    ],
    NeedToSelectReward: 0,
    RandomReward: 0,
    RandomRewardAmount: -1,
    RewardsForGroupOwnerOnly: 1,
    RewardBehavior: 0,
    QuestGiverIDs: [1],
    QuestTurnInIDs: [1],
    IsAchievement: 0,
    Objectives: [
      {
        ConfigVersion: 28,
        ID: TEST_ID,
        ObjectiveType: Number(typeId)
      }
    ],
    QuestColor: 0,
    ReputationReward: 100,
    ReputationRequirement: -1,
    PreQuestIDs: [],
    RequiredFaction: "",
    FactionReward: "",
    PlayerNeedQuestItems: 1,
    DeleteQuestItems: 1,
    SequentialObjectives: 1,
    FactionReputationRequirements: {},
    FactionReputationRewards: {},
    SuppressQuestLogOnCompetion: 0,
    Active: 1
  };

  const objPath = path.join(projectRoot, configPrefix, 'Quests', 'Objectives', info.folder, `Objective_${info.prefix}_${TEST_ID}.json`);
  const questPath = path.join(projectRoot, configPrefix, 'Quests', 'Quests', `Quest_${TEST_ID}.json`);

  return { objPath, objTemplate, questPath, questTemplate };
}

// Main testing routine
function runTests() {
  console.log("=== STARTING QUEST WIZARD GENERATOR TESTS ===");
  const testTypes = [2, 3, 4, 5]; // Target, Travel, Collection, Delivery
  const createdFiles = [];

  try {
    for (const typeId of testTypes) {
      const typeName = OBJECTIVE_TYPES[typeId].folder;
      console.log(`\nTesting configuration generation for type: ${typeName} (ID ${typeId})...`);

      const { objPath, objTemplate, questPath, questTemplate } = generateQuestAndObjective(
        typeId,
        `Test Quest for ${typeName}`,
        `Complete ${typeName} Objective`
      );

      // Create containing directories if they don't exist
      fs.mkdirSync(path.dirname(objPath), { recursive: true });
      fs.mkdirSync(path.dirname(questPath), { recursive: true });

      // Write files
      fs.writeFileSync(objPath, JSON.stringify(objTemplate, null, 2), 'utf8');
      createdFiles.push(objPath);
      console.log(`✔ Created objective file: ${path.relative(projectRoot, objPath)}`);

      fs.writeFileSync(questPath, JSON.stringify(questTemplate, null, 2), 'utf8');
      createdFiles.push(questPath);
      console.log(`✔ Created quest file: ${path.relative(projectRoot, questPath)}`);

      // Verify basic properties
      const parsedObj = JSON.parse(fs.readFileSync(objPath, 'utf8'));
      const parsedQuest = JSON.parse(fs.readFileSync(questPath, 'utf8'));

      if (parsedObj.ID !== TEST_ID) throw new Error(`Objective ID mismatch: expected ${TEST_ID}, got ${parsedObj.ID}`);
      if (parsedObj.ObjectiveType !== typeId) throw new Error(`ObjectiveType mismatch: expected ${typeId}, got ${parsedObj.ObjectiveType}`);
      if (parsedQuest.ID !== TEST_ID) throw new Error(`Quest ID mismatch: expected ${TEST_ID}, got ${parsedQuest.ID}`);
      if (parsedQuest.Objectives[0].ID !== TEST_ID) throw new Error(`Linked objective ID mismatch in quest`);
      if (parsedQuest.Objectives[0].ObjectiveType !== typeId) throw new Error(`Linked objective type mismatch in quest`);

      console.log(`✔ In-memory checks passed for ${typeName}.`);
    }

    console.log("\nAll wizard generated files successfully written & self-validated!");
    console.log("Executing validate_configs.js check to verify schema compatibility...");

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    cleanup(createdFiles);
    process.exit(1);
  }

  // Cleanup will be run after the next command runs validate_configs.js or we can run it now
  // We actually keep them momentarily so we can run npm run check-configs to see if they pass.
  // Wait, let's keep them and output instructions to run check-configs.
  // Actually, we can run check-configs via Node child process directly inside this script!
  // That way we can clean up automatically.
  import('child_process').then(({ execSync }) => {
    try {
      console.log("\nRunning validation script...");
      const output = execSync('node scripts/validate_configs.js', { encoding: 'utf8' });
      console.log(output);
      console.log("✔ Validation script successfully accepted all newly generated wizard configurations!");
    } catch (err) {
      console.error("❌ Validation script reported errors on generated files:");
      console.error(err.stdout || err.message);
      cleanup(createdFiles);
      process.exit(1);
    }

    cleanup(createdFiles);
    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
  });
}

function cleanup(files) {
  console.log("\nCleaning up temporary test files...");
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`Deleted: ${path.relative(projectRoot, file)}`);
    }
  }
}

runTests();
