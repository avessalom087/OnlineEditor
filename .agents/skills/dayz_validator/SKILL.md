---
name: DayZ Configuration Validator
description: Validation rules and execution guide for checking DayZ Expansion and related JSON configs against server item databases (types.xml).
---

# DayZ Config Validator Skill

This skill provides guidelines and instructions for validating DayZ-specific configuration files inside this workspace. Use the validation scripts before proposing or saving changes to configuration files.

## Whitelisted Folders
Only config files within these directories should be audited or edited:
- `expansion`
- `expansionmod`
- `mpg_spawner`
- `searchforloot`

Do NOT modify or audit backup folders (e.g. `backups`) or temporary directories.

## Validation Script
Before final submission or during design verification, run the validation script to verify formatting and item classname validity:
```bash
npm run check-configs
```

### Script Details
- **Location**: `scripts/validate_configs.js`
- **Behavior**:
  - Scans JSON configurations in the whitelisted folders.
  - Safely parses them by stripping single-line/multi-line comments and trailing commas using `cleanJsonComments`.
  - Parses any `.xml` files in the workspace (using regex `<type name="...">` search) to construct a valid classname database.
  - Traverses the JSON configurations recursively to verify that item classname values (found in fields like `classname`, `loot`, `items`, etc.) match items loaded in the XML database, reporting any missing entries.
