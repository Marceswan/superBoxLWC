# SuperBox LWC Components

A collection of Salesforce Lightning Web Components (LWC) that provide enhanced picklist selection capabilities with custom help text definitions for Flow screens.

## Components Overview

This package includes two main components:

1. **superListBoxLWC** - Multi-select picklist with dual listbox interface
2. **superComboboxLWC** - Single-select picklist with dropdown interface

Both components feature:
- Dynamic picklist value loading from any Salesforce object
- Custom help text definitions for each picklist value
- Custom Property Editors (CPE) for easy configuration in Flow Builder
- Inline help tooltips showing definitions when hovering over values

## Component Details

### superListBoxLWC (Multi-Select)

A Flow-enabled component that displays a dual listbox for selecting multiple picklist values, with optional help text definitions for each value.

#### Features
- **Dual Listbox Interface**: Available/Selected columns with move buttons
- **Custom Help Tooltips**: Displays help text icons next to values when definitions are provided
- **Dynamic Field Loading**: Loads only multi-select picklist fields from the selected object
- **Dual Output Formats**: Returns selections as both string and collection

#### Input Properties
- `objectApiName` (String, Required): The API name of the Salesforce object
- `fieldApiName` (String, Required): The API name of the multi-select picklist field
- `recordTypeId` (String, Optional): Record Type ID to filter picklist values
- `cardTitle` (String): Label displayed on the component card (default: "Select Values")
- `isRequired` (Boolean): Whether selection is required
- `initialSelectedValues` (String[]): Pre-selected values
- `picklistDefinitions` (String): JSON string containing value definitions

#### Output Properties
- `selectedAsString` (String): Selected values as semicolon-separated string
- `selectedAsCollection` (String[]): Selected values as string collection

### superComboboxLWC (Single-Select)

A Flow-enabled component that displays a dropdown combobox for selecting a single picklist value, with inline help icons in the dropdown.

#### Features
- **Custom Dropdown**: Shows help icons directly in the dropdown next to each option
- **Hover Tooltips**: Help text appears when hovering over the info icons
- **Dynamic Field Loading**: Loads only single-select picklist fields from the selected object
- **Clean Interface**: Standard combobox when no definitions, enhanced UI with definitions

#### Input Properties
- `objectApiName` (String, Required): The API name of the Salesforce object
- `fieldApiName` (String, Required): The API name of the single-select picklist field
- `recordTypeId` (String, Optional): Record Type ID to filter picklist values
- `cardTitle` (String): Label displayed on the component (default: "Select Value")
- `placeholder` (String): Placeholder text for the dropdown (default: "Choose a value")
- `isRequired` (Boolean): Whether selection is required
- `initialSelectedValue` (String): Pre-selected value
- `picklistDefinitions` (String): JSON string containing value definitions

#### Output Properties
- `selectedValue` (String): Selected value as string

## Custom Property Editors (CPE)

Both components include custom property editors that provide an intuitive configuration experience in Flow Builder:

### Features
- **Object Selection**: Dropdown list of all accessible Salesforce objects
- **Field Selection**: Filtered list showing only appropriate picklist fields (multi-select or single-select)
- **Definition Editor**: Interface to add custom help text for each picklist value
- **Live Preview**: Changes are reflected in the Flow Builder preview (deploy required for full update)

### How to Use CPE
1. Add the component to a Flow screen
2. Click the component to open its configuration
3. Select the target object from the dropdown
4. Select the appropriate picklist field
5. Define help text for each picklist value in the definitions section
6. Configure other properties as needed

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/Marceswan/superBoxLWC.git
   ```

2. Deploy to your Salesforce org:
   ```bash
   sf project deploy start
   ```

## Usage in Flow

### For Multi-Select (superListBoxLWC)
1. In Flow Builder, add a Screen element
2. Drag the "Super List Box LWC" component onto the screen
3. Configure using the custom property editor:
   - Select Object (e.g., "Account")
   - Select Multi-Select Field (e.g., "Products__c")
   - Add help text definitions for values
4. Store outputs in Flow variables

### For Single-Select (superComboboxLWC)
1. In Flow Builder, add a Screen element
2. Drag the "Super Combobox LWC" component onto the screen
3. Configure using the custom property editor:
   - Select Object (e.g., "Account")
   - Select Single-Select Field (e.g., "Type")
   - Add help text definitions for values
4. Store output in a Flow variable

## Architecture

### Components Structure
```
force-app/main/default/
├── lwc/
│   ├── superListBoxLWC/          # Multi-select component
│   ├── superListBoxCPE/          # Multi-select property editor
│   ├── superComboboxLWC/         # Single-select component
│   └── superComboboxCPE/         # Single-select property editor
└── classes/
    └── SuperListBoxController/   # Apex controller for dynamic data
```

### Key Technical Features
- **Wire Adapters**: Uses Lightning Data Service for picklist values
- **Dynamic Apex**: Controller methods to fetch objects and fields
- **Reactive Properties**: Real-time updates when configuration changes
- **Custom UI Rendering**: Switches between standard and enhanced UI based on definitions

## Development

This is a standard SFDX project structure. To work with these components:

1. Ensure you have Salesforce CLI installed
2. Authorize your org: `sf org login web`
3. Make changes to component files
4. Deploy changes: `sf project deploy start`
5. Test in Flow Builder

### Running Tests
```bash
# Run Apex tests
sf apex test run --test-level RunLocalTests

# Check code coverage
sf apex test report --test-run-id <test-run-id>
```

## Best Practices

1. **Performance**: The components efficiently load only the required picklist values
2. **Security**: Respects field-level security and object permissions
3. **Accessibility**: Includes proper ARIA labels and keyboard navigation
4. **Maintainability**: Clean separation between UI components and property editors

## Troubleshooting

### Common Issues
1. **Fields not showing**: Ensure the user has access to the object and fields
2. **Definitions not appearing**: Check that definitions are properly formatted JSON
3. **CPE not loading**: Verify all components are deployed together

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.