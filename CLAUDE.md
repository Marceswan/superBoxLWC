# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SuperBox LWC is a collection of Flow-enabled Lightning Web Components that provide enhanced picklist selection capabilities with custom help text definitions. The project includes:

- `superListBoxLWC` / `superListBoxCPE` - Multi-select picklist with dual listbox interface
- `superComboboxLWC` / `superComboboxCPE` - Single-select picklist with dropdown interface
- `SuperListBoxController` - Apex controller for dynamic metadata access

## Essential Commands

### Deployment
```bash
# Deploy entire project
sf project deploy start

# Deploy specific components only (IMPORTANT: Always deploy only the files being worked on)
sf project deploy start --source-dir force-app/main/default/lwc/superListBoxLWC
sf project deploy start --source-dir force-app/main/default/lwc/superComboboxLWC
sf project deploy start --source-dir force-app/main/default/classes/SuperListBoxController.cls
```

### Testing
```bash
# Run all Apex tests (minimum 90% coverage required)
sf apex test run --test-level RunLocalTests

# Check test results and coverage
sf apex test report --test-run-id <test-run-id>

# Run Jest tests for LWC
npm run test:unit
npm run test:unit:coverage
```

### Code Quality
```bash
# Lint JavaScript/LWC files
npm run lint

# Format code
npm run prettier

# Fix linting issues automatically
npm run lint -- --fix
```

## Architecture Overview

### Component Structure
Each main component has a corresponding Custom Property Editor (CPE):
- Main components handle runtime display and user interaction
- CPE components provide Flow Builder configuration interface
- Both use shared patterns for picklist value retrieval and configuration

### Data Flow Pattern
1. CPE receives `builderContext` containing Flow variables and configuration
2. User configures object/field selections and custom definitions in CPE
3. Configuration is passed to main component via Flow attributes
4. Main component uses Lightning Data Service to fetch picklist values
5. Component renders with custom UI if definitions exist, standard UI otherwise

### Flow Integration
- Components implement `FlowAttributeChangeEvent` for output value updates
- Input properties can reference Flow variables using `{!variableName}` syntax
- CPE components use `configuration_editor_input_value_changed` events
- Validation is handled via `@api validate()` method

### Key Implementation Details
- Custom definitions stored as JSON strings in `picklistDefinitions` property
- Components dynamically switch UI based on presence of custom definitions
- Wire adapters cache picklist values for performance
- CPE loads available Flow variables from `builderContext.variables`

## Development Guidelines

### When Making Changes
1. Always test in a Flow screen after deployment
2. Deploy only the specific files you're working on
3. Run Apex tests if modifying controller logic
4. Ensure CPE changes properly dispatch configuration events

### Common Patterns
- Use `@track` for reactive properties that trigger UI updates
- Implement proper null checking for wire adapter data
- Maintain consistent error handling across components
- Follow existing code style and naming conventions