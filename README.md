# superBoxLWC

A Salesforce Lightning Web Component (LWC) that provides a dual listbox for selecting picklist values in Flow screens.

## Component Overview

The `superListBoxLWC` is a Flow-enabled Lightning Web Component that allows users to select multiple values from picklist fields dynamically. It's designed to work within Salesforce Flow screens and provides both string and collection outputs.

## Features

- **Dynamic Picklist Loading**: Loads picklist values based on object and field API names
- **Record Type Support**: Filters picklist values by record type (optional)
- **Pre-selection Support**: Allows initial values to be pre-selected
- **Dual Output Formats**: Returns selected values as both semicolon-separated string and string collection
- **Validation**: Built-in validation for required field scenarios
- **Customizable Label**: Configurable card title for the component

## Component Properties

### Input Properties
- `objectApiName` (String): The API name of the Salesforce object
- `fieldApiName` (String): The API name of the picklist field
- `recordTypeId` (String, Optional): Record Type ID to filter picklist values
- `cardTitle` (String): Label displayed on the component card
- `isRequired` (Boolean): Whether input is required
- `initialSelectedValues` (String[]): Pre-selected values

### Output Properties
- `selectedAsString` (String): Selected values as semicolon-separated string
- `selectedAsCollection` (String[]): Selected values as string collection

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

1. In Flow Builder, add a Screen element
2. Drag the "Super List Box LWC" component onto the screen
3. Configure the required properties:
   - Set the Object API Name (e.g., "Account")
   - Set the Field API Name (e.g., "Industry")
   - Optionally set other properties as needed
4. Store the output in Flow variables for further processing

## Development

This is a standard SFDX project structure. To work with this component:

1. Ensure you have Salesforce CLI installed
2. Authorize your org: `sf org login web`
3. Make changes to the component files in `force-app/main/default/lwc/superListBoxLWC/`
4. Deploy changes: `sf project deploy start`

## License

This project is licensed under the MIT License.