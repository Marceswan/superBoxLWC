# Custom Property Editor Developer Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Guide](#implementation-guide)
5. [Event Flow and Communication](#event-flow-and-communication)
6. [Lifecycle and Initialization](#lifecycle-and-initialization)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)
9. [Troubleshooting](#troubleshooting)
10. [Advanced Topics](#advanced-topics)

## Introduction

Custom Property Editors (CPEs) are specialized Lightning Web Components that provide configuration interfaces for Flow screen components within Salesforce Flow Builder. This guide provides comprehensive documentation for developing CPEs based on the SuperBox LWC project implementation.

### What is a Custom Property Editor?

A CPE is a Lightning Web Component that:
- Appears in the Flow Builder interface when configuring a screen component
- Provides a custom UI for setting component properties
- Communicates with Flow Builder through specific JavaScript interfaces
- Enables dynamic configuration based on Flow context

### When to Use a CPE

Create a CPE when you need:
- Complex configuration beyond simple input fields
- Dynamic options based on org metadata
- Conditional configuration based on other settings
- Integration with Flow variables and resources
- Custom validation logic

## Core Concepts

### Component Pairing

Each Flow screen component can have an associated CPE:

```xml
<!-- Main component meta.xml -->
<targetConfig targets="lightning__FlowScreen" configurationEditor="c-super-list-box-c-p-e">
    <property name="objectApiName" type="String" label="Object API Name"/>
    <property name="fieldApiName" type="String" label="Field API Name"/>
    <!-- Other properties -->
</targetConfig>
```

### JavaScript Interfaces

CPEs communicate with Flow Builder through four main interfaces:

#### 1. builderContext
Provides metadata about the flow and available resources:

```javascript
@api
get builderContext() {
    return this._builderContext;
}
set builderContext(context) {
    this._builderContext = context || {};
    // Access flow metadata
    // context.variables - Flow variables
    // context.elementInfos - Information about flow elements
    // context.formulas - Formula fields
    // context.objectInfos - Object metadata
    // Note: context.automaticOutputVariables may not be populated here
}
```

#### 2. inputVariables
Receives current configuration values:

```javascript
@api
get inputVariables() {
    return this._inputVariables;
}
set inputVariables(variables) {
    this._inputVariables = variables || [];
    this.initializeValues(); // Restore saved configuration
}
```

#### 3. genericTypeMappings
Handles generic sObject type mappings:

```javascript
@api
get genericTypeMappings() {
    return this._genericTypeMappings;
}
set genericTypeMappings(mappings) {
    this._genericTypeMappings = mappings || [];
    this.initializeGenericType();
}
```

#### 4. automaticOutputVariables
Provides access to output variables from other Flow components:

```javascript
@api
get automaticOutputVariables() {
    return this._automaticOutputVariables;
}
set automaticOutputVariables(variables) {
    this._automaticOutputVariables = variables || [];
    // Reload flow variables when automatic output variables are updated
    this.loadFlowVariables();
}
```

**Important Notes:**
- The `automaticOutputVariables` interface is separate from `builderContext.automaticOutputVariables`
- This interface may be called after `builderContext` and `inputVariables`
- When using external components like `fsc_flow-combobox`, pass both `builderContext` and `automaticOutputVariables` as properties

## Architecture Overview

### Data Flow Architecture

```
┌─────────────────┐     Configuration      ┌──────────────┐
│                 │ ◀──────────────────────│              │
│   Flow Builder  │                        │     CPE      │
│                 │ ────────────────────▶  │  Component   │
└─────────────────┘     Context/Values     └──────────────┘
         │                                          │
         │                                          │ May use external
         │ Runtime Values                           │ components
         │                                          │
         ▼                                          ▼
┌─────────────────┐                        ┌──────────────────┐
│                 │                        │ fsc_flow-combobox│
│ Main Component  │ ◀───────────────────── │ or other helpers │
│                 │      Updated Props      └──────────────────┘
└─────────────────┘                        
```

### Modern CPE Architecture Pattern

The latest pattern delegates complex functionality to specialized components:
- **CPE Component**: Handles object/field selection and basic configuration
- **External Components** (e.g., fsc_flow-combobox): Handle Flow variable selection
- **Benefits**: Reusability, consistency, reduced complexity

### Component Structure

```
force-app/main/default/lwc/
├── superListBoxLWC/          # Main runtime component
│   ├── superListBoxLWC.js
│   ├── superListBoxLWC.html
│   └── superListBoxLWC.js-meta.xml
├── superListBoxCPE/          # Configuration editor
│   ├── superListBoxCPE.js
│   ├── superListBoxCPE.html
│   └── superListBoxCPE.js-meta.xml
└── classes/
    └── SuperListBoxController.cls  # Apex support
```

## Implementation Guide

### Step 1: Create the CPE Component

```javascript
import { LightningElement, api, track } from 'lwc';

export default class MyCustomPropertyEditor extends LightningElement {
    // Flow Builder interfaces
    _builderContext = {};
    _inputVariables = [];
    _genericTypeMappings = [];
    _automaticOutputVariables = [];
    
    // UI State
    @track isLoading = false;
    @track options = [];
    
    // Configuration values
    selectedValue;
    
    @api
    get builderContext() {
        return this._builderContext;
    }
    set builderContext(context) {
        this._builderContext = context || {};
        this.loadContextData();
    }
    
    @api
    get inputVariables() {
        return this._inputVariables;
    }
    set inputVariables(variables) {
        this._inputVariables = variables || [];
        this.initializeValues();
    }
    
    @api
    get automaticOutputVariables() {
        return this._automaticOutputVariables;
    }
    set automaticOutputVariables(variables) {
        this._automaticOutputVariables = variables || [];
        this.loadFlowVariables();
    }
}
```

### Step 2: Handle Configuration Changes

```javascript
dispatchConfigurationChange(name, value) {
    const valueChangeEvent = new CustomEvent('configuration_editor_input_value_changed', {
        bubbles: true,          // Required
        cancelable: false,
        composed: true,         // Required
        detail: {
            name: name,         // Property name
            newValue: value,    // New value
            newValueDataType: this.getDataType(name)  // Data type
        }
    });
    this.dispatchEvent(valueChangeEvent);
}

getDataType(name) {
    switch (name) {
        case 'isRequired':
            return 'Boolean';
        case 'initialSelectedValues':  // For multi-select
        case 'selectedAsCollection':
            return 'String[]';
        case 'initialSelectedValue':   // For single-select
        default:
            return 'String';
    }
}
```

### Step 3: Initialize Values

```javascript
initializeValues() {
    let fieldToSet = null;
    
    if (this._inputVariables && Array.isArray(this._inputVariables)) {
        this._inputVariables.forEach(variable => {
            switch (variable.name) {
                case 'objectApiName':
                    this.selectedObject = variable.value;
                    break;
                case 'fieldApiName':
                    // Store field to set after options load
                    fieldToSet = variable.value;
                    break;
                case 'isRequired':
                    this.isRequired = variable.value === true || variable.value === 'true';
                    break;
                case 'initialSelectedValues':
                    // Handle Flow variable references
                    if (typeof variable.value === 'string' && variable.value.startsWith('{!')) {
                        this.initialSelectedValues = variable.value;
                    } else {
                        this.initialSelectedValues = variable.value || [];
                    }
                    break;
                // Handle other properties
            }
        });
    }
    
    // Load field options if object is set
    if (this.selectedObject && fieldToSet) {
        this.loadFieldOptions(fieldToSet);
    }
}
```

### Step 4: Integrate with Flow Variable Selector Components

Modern CPE implementations often delegate Flow variable selection to specialized components like `fsc_flow-combobox` from [Unofficial SF](https://unofficialsf.com/develop-custom-property-editors-quickly-with-flowcombobox/), used here:

```html
<!-- For single-select (String) variables -->
<c-fsc_flow-combobox
    name="initialSelectedValue"
    label="Initial Selected Value"
    value={initialSelectedValue}
    builder-context={builderContext}
    automatic-output-variables={automaticOutputVariables}
    onvaluechanged={handleInitialSelectedValueChange}
></c-fsc_flow-combobox>

<!-- For multi-select (String[]) variables -->
<c-fsc_flow-combobox
    name="initialSelectedValues"
    label="Initial Selected Values"
    value={initialSelectedValues}
    builder-context={builderContext}
    automatic-output-variables={automaticOutputVariables}
    onvaluechanged={handleInitialSelectedValuesChange}
></c-fsc_flow-combobox>
```

**Event Handling for External Components:**
```javascript
handleInitialSelectedValueChange(event) {
    // Note: fsc_flow-combobox uses 'newValue' in event detail
    this.initialSelectedValue = event.detail.newValue;
    this.dispatchConfigurationChange('initialSelectedValue', this.initialSelectedValue);
}

handleInitialSelectedValuesChange(event) {
    this.initialSelectedValues = event.detail.newValue;
    this.dispatchConfigurationChange('initialSelectedValues', this.initialSelectedValues);
}
```

**Benefits of this approach:**
- Standardized Flow variable selection UI
- Automatic handling of variable discovery
- Built-in support for both regular variables and output variables
- No need to implement `loadFlowVariables()` manually

**Alternative: Manual Flow Variable Loading**

If you need to implement your own Flow variable selector:

```javascript
loadFlowVariables() {
    const variables = [];
    const processedVariables = new Set();
    
    // Add none option
    variables.push({ label: '--None--', value: '' });
    
    // Process regular flow variables
    if (this._builderContext?.variables) {
        this._builderContext.variables.forEach(variable => {
            // Filter based on type needs
            if (variable.dataType === 'String' && !variable.isCollection) {
                const variableRef = '{!' + variable.name + '}';
                if (!processedVariables.has(variableRef)) {
                    variables.push({
                        label: variable.name,
                        value: variableRef
                    });
                    processedVariables.add(variableRef);
                }
            }
        });
    }
    
    // Process automatic output variables
    if (this._automaticOutputVariables?.length > 0) {
        this._automaticOutputVariables.forEach(autoVar => {
            if (autoVar.dataType === 'String' && !autoVar.isCollection) {
                const variableRef = '{!' + autoVar.name + '}';
                if (!processedVariables.has(variableRef)) {
                    const label = autoVar.elementName ? 
                        `${autoVar.name} (from ${autoVar.elementName})` : 
                        autoVar.name;
                    variables.push({
                        label: label,
                        value: variableRef
                    });
                    processedVariables.add(variableRef);
                }
            }
        });
    }
    
    this.flowVariableOptions = variables;
}
```

### Step 5: Implement Validation

```javascript
@api
validate() {
    const errors = [];
    
    if (!this.selectedObject) {
        errors.push({
            key: 'OBJECT_REQUIRED',
            errorString: 'Please select an object'
        });
    }
    
    if (!this.selectedField) {
        errors.push({
            key: 'FIELD_REQUIRED',
            errorString: 'Please select a field'
        });
    }
    
    return errors;
}
```

## Event Flow and Communication

### Configuration Change Event Flow

```
User Action → CPE Handler → Dispatch Event → Flow Builder → Update Main Component
```

#### Detailed Event Flow:

1. **User makes change in CPE**
   ```javascript
   handleFieldChange(event) {
       this.selectedField = event.detail.value;
       this.dispatchConfigurationChange('fieldApiName', this.selectedField);
   }
   ```

2. **Event bubbles to Flow Builder**
   ```javascript
   // Event structure
   {
       type: 'configuration_editor_input_value_changed',
       detail: {
           name: 'fieldApiName',
           newValue: 'Industry',
           newValueDataType: 'String'
       }
   }
   ```

3. **Flow Builder updates main component**
   ```javascript
   // Main component setter
   @api
   set fieldApiName(value) {
       this._fieldApiName = value;
       // Trigger updates
   }
   ```

4. **Main component dispatches output events**
   ```javascript
   // Using FlowAttributeChangeEvent
   const attributeChangeEvent = new FlowAttributeChangeEvent(
       'selectedValue',
       this.selectedValue
   );
   this.dispatchEvent(attributeChangeEvent);
   ```

### Event Types

#### configuration_editor_input_value_changed
Primary event for configuration changes:

```javascript
this.dispatchEvent(new CustomEvent('configuration_editor_input_value_changed', {
    bubbles: true,
    composed: true,
    detail: {
        name: 'propertyName',
        newValue: value,
        newValueDataType: 'String'
    }
}));
```

#### configuration_editor_generic_type_mapping_changed
For generic sObject type changes:

```javascript
this.dispatchEvent(new CustomEvent('configuration_editor_generic_type_mapping_changed', {
    bubbles: true,
    composed: true,
    detail: {
        typeName: 'T',
        typeValue: 'Account'
    }
}));
```

## Lifecycle and Initialization

### Complete Initialization Timeline

1. **T0: Component Creation**
   - CPE component instantiated by Flow Builder
   - Default property values set

2. **T1: builderContext Set**
   - Flow metadata provided
   - Triggers initial data loading
   ```javascript
   set builderContext(context) {
       this._builderContext = context || {};
       this.loadObjectOptions();
       // Note: loadFlowVariables() removed when using external components
   }
   ```

3. **T2: inputVariables Set**
   - Existing configuration values provided
   - Triggers value restoration
   ```javascript
   set inputVariables(variables) {
       this._inputVariables = variables || [];
       this.initializeValues();
   }
   ```

4. **T3: genericTypeMappings Set** (if applicable)
   - Generic type mappings provided
   - Usually empty in standard implementations

5. **T4: automaticOutputVariables Set**
   - Output variables from other components provided
   - When using external components: Simply stored for passing to child components
   - When implementing manually: Triggers flow variable refresh
   ```javascript
   set automaticOutputVariables(variables) {
       this._automaticOutputVariables = variables || [];
       // Only needed if implementing manual variable selection:
       // this.loadFlowVariables();
   }
   ```

6. **T5: connectedCallback**
   - Component inserted into DOM
   - Additional initialization if needed
   ```javascript
   connectedCallback() {
       this.loadInitialData();
   }
   ```

7. **T6: Data Loading Phase**
   - Async calls to load metadata
   - Loading states managed
   ```javascript
   async loadObjectOptions() {
       this.isLoadingObjects = true;
       try {
           const options = await getObjectOptions();
           this.objectOptions = options || [];
       } catch (error) {
           this.handleError(error);
       } finally {
           this.isLoadingObjects = false;
       }
   }
   ```

8. **T7: User Interaction Ready**
   - All data loaded
   - UI fully interactive
   - Configuration changes trigger events

### State Management During Lifecycle

```javascript
// Initial state
{
    isLoading: false,
    objectOptions: [],
    fieldOptions: [],
    selectedObject: null,
    selectedField: null
}

// After builderContext
{
    isLoading: true,
    flowVariables: [...],
    // Loading objects...
}

// After inputVariables
{
    selectedObject: 'Account',  // Restored
    selectedField: 'Industry',  // Restored
    // Loading field options...
}

// Fully initialized
{
    isLoading: false,
    objectOptions: [...],
    fieldOptions: [...],
    flowVariables: [...],
    selectedObject: 'Account',
    selectedField: 'Industry'
}
```

## Best Practices

### 1. Error Handling

Always implement comprehensive error handling:

```javascript
async loadData() {
    this.isLoading = true;
    this.error = null;
    
    try {
        const data = await fetchData();
        this.processData(data);
    } catch (error) {
        console.error('Error loading data:', error);
        this.error = error.message;
        // Provide fallback behavior
        this.loadFallbackData();
    } finally {
        this.isLoading = false;
    }
}
```

### 2. Loading States

Provide visual feedback during async operations:

```javascript
<!-- Template -->
<template if:true={isLoading}>
    <lightning-spinner alternative-text="Loading"></lightning-spinner>
</template>
<template if:false={isLoading}>
    <!-- Main content -->
</template>
```

### 3. Event Dispatching

Dispatch events immediately on change:

```javascript
handleChange(event) {
    const { name, value } = event.target;
    
    // Update local state
    this[name] = value;
    
    // Dispatch immediately
    this.dispatchConfigurationChange(name, value);
    
    // Trigger dependent updates
    this.updateDependentFields(name);
}
```

### 4. Value Preservation

Preserve valid selections when parent values change:

```javascript
async loadFieldOptions(fieldToSet) {
    const savedSelection = fieldToSet || this.selectedField;
    
    // Load new options
    const options = await getFieldOptions(this.selectedObject);
    this.fieldOptions = options;
    
    // Restore selection if still valid
    const stillValid = options.some(opt => opt.value === savedSelection);
    if (stillValid) {
        this.selectedField = savedSelection;
    } else {
        this.selectedField = null;
        this.dispatchConfigurationChange('fieldApiName', null);
    }
}
```

### 5. Flow Variable References

Support both direct values and variable references:

```javascript
initializeValue(variable) {
    if (typeof variable.value === 'string' && variable.value.startsWith('{!')) {
        // It's a Flow variable reference
        this.selectedValue = variable.value;
        this.isFlowReference = true;
    } else {
        // It's a direct value
        this.selectedValue = variable.value;
        this.isFlowReference = false;
    }
}
```

## Common Patterns

### Progressive Disclosure

Show configuration options progressively:

```html
<template>
    <!-- Step 1: Object Selection -->
    <lightning-combobox
        label="Select Object"
        value={selectedObject}
        options={objectOptions}
        onchange={handleObjectChange}
    ></lightning-combobox>
    
    <!-- Step 2: Field Selection (shown after object selected) -->
    <template if:true={selectedObject}>
        <lightning-combobox
            label="Select Field"
            value={selectedField}
            options={fieldOptions}
            onchange={handleFieldChange}
        ></lightning-combobox>
    </template>
    
    <!-- Step 3: Additional Options (shown after field selected) -->
    <template if:true={selectedField}>
        <!-- Additional configuration options -->
    </template>
</template>
```

### Field Type Filtering

Filter fields based on type requirements:

```javascript
async loadFieldOptions(fieldToSet) {
    try {
        const fields = await getPicklistFields({ objectApiName: this.selectedObject });
        
        // For multi-select components
        this.fieldOptions = fields.filter(field => field.isMultiSelect === true);
        
        // For single-select components
        this.fieldOptions = fields.filter(field => field.isMultiSelect === false);
        
        // Restore saved selection if valid
        if (fieldToSet && this.fieldOptions.some(f => f.value === fieldToSet)) {
            this.selectedField = fieldToSet;
        }
    } catch (error) {
        console.error('Error loading fields:', error);
        this.fieldOptions = [];
    }
}
```

### Dynamic Metadata Loading

Load metadata based on user selections:

```javascript
@wire(getObjectInfo, { objectApiName: '$selectedObject' })
wiredObjectInfo({ error, data }) {
    if (data) {
        this.effectiveRecordTypeId = this.selectedRecordTypeId || data.defaultRecordTypeId;
    } else if (error) {
        this.handleError(error);
    }
}

@wire(getPicklistValuesByRecordType, { 
    objectApiName: '$selectedObject',
    recordTypeId: '$effectiveRecordTypeId'
})
wiredPicklistValues({ error, data }) {
    if (data) {
        this._picklistData = data; // Cache for manual processing
        this.processPicklistValues(data);
    } else if (error) {
        this.handleError(error);
    }
}

// Manual processing when field changes
processPicklistValues(data) {
    if (data && this.selectedField) {
        if (data.picklistFieldValues?.[this.selectedField]) {
            const fieldData = data.picklistFieldValues[this.selectedField];
            this.picklistValues = fieldData.values.map(item => ({
                label: item.label,
                value: item.value,
                definition: this.customDefinitions[item.value] || ''
            }));
            this.showPicklistDefinitions = true;
        }
    }
}
```

### Custom Definition Storage

Store complex configurations as JSON:

```javascript
handleCustomDefinitionChange(event) {
    const { value, dataset } = event.target;
    const picklistValue = dataset.value;
    
    // Update definitions object
    this.customDefinitions[picklistValue] = value;
    
    // Convert to JSON and dispatch
    const definitionsJson = JSON.stringify(this.customDefinitions);
    this.dispatchConfigurationChange('customDefinitions', definitionsJson);
}

// In main component
@api
set customDefinitions(value) {
    try {
        this._customDefinitions = JSON.parse(value || '{}');
    } catch (e) {
        this._customDefinitions = {};
    }
}
```

### Fallback Options

Provide fallback options when dynamic loading fails:

```javascript
loadFallbackObjectOptions() {
    this.objectOptions = [
        { label: 'Account', value: 'Account' },
        { label: 'Contact', value: 'Contact' },
        { label: 'Lead', value: 'Lead' },
        { label: 'Opportunity', value: 'Opportunity' },
        { label: 'Case', value: 'Case' }
    ];
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Events Not Reaching Flow Builder

**Problem**: Configuration changes not saving
**Solution**: Ensure events have `bubbles: true` and `composed: true`

```javascript
// Correct
new CustomEvent('configuration_editor_input_value_changed', {
    bubbles: true,      // ✓ Required
    composed: true,     // ✓ Required
    detail: { ... }
});
```

#### 2. Values Not Initializing

**Problem**: Saved values not appearing when reopening
**Solution**: Check `inputVariables` processing

```javascript
set inputVariables(variables) {
    this._inputVariables = variables || [];
    console.log('Input variables:', this._inputVariables);
    this.initializeValues();
}
```

#### 3. Flow Variables Not Appearing

**Problem**: Can't see Flow variables in dropdown
**Solution**: Check variable data type and collection status

```javascript
// For single-select components (String variables)
if (variable.dataType === 'String' && !variable.isCollection) {
    variables.push({
        label: variable.name,
        value: '{!' + variable.name + '}'
    });
}

// For multi-select components (String[] variables)
if (variable.dataType === 'String' && variable.isCollection === true) {
    variables.push({
        label: variable.name,
        value: '{!' + variable.name + '}'
    });
}
```

**Also check:**
- The `automaticOutputVariables` interface is properly implemented
- You're checking both `_builderContext.variables` and `_automaticOutputVariables`
- Look for outputs in `_builderContext.elementInfos`

#### 4. Apex Calls Failing

**Problem**: Unable to load object/field metadata
**Solution**: Implement proper error handling and fallbacks

```javascript
try {
    const options = await getObjectOptions();
    this.objectOptions = options || [];
} catch (error) {
    console.error('Apex error:', error);
    this.loadFallbackObjectOptions();
    this.showError('Unable to load objects. Using default list.');
}
```

### Debugging Tips

1. **Console Logging**
   ```javascript
   set builderContext(context) {
       console.log('Builder Context:', context);
       this._builderContext = context || {};
   }
   ```

2. **Event Monitoring**
   ```javascript
   dispatchConfigurationChange(name, value) {
       console.log(`Dispatching change: ${name} = ${value}`);
       // ... dispatch event
   }
   ```

3. **State Inspection**
   ```javascript
   connectedCallback() {
       // Add to window for debugging
       window.debugCPE = this;
   }
   ```

## Advanced Topics

### Generic sObject Support

Handle generic sObject types for reusable components:

```javascript
// In meta.xml
<property name="recordId" type="{T}" label="Record"/>
<propertyType name="T" extends="SObject" label="Object Type"/>

// In CPE
handleObjectTypeChange(event) {
    const objectType = event.detail.value;
    
    // Dispatch generic type mapping
    this.dispatchEvent(new CustomEvent('configuration_editor_generic_type_mapping_changed', {
        bubbles: true,
        composed: true,
        detail: {
            typeName: 'T',
            typeValue: objectType
        }
    }));
}
```

### Dynamic Property Generation

Generate properties based on runtime configuration:

```javascript
get dynamicProperties() {
    const properties = [];
    
    if (this.selectedObject === 'Account') {
        properties.push({
            name: 'accountSpecificField',
            label: 'Account Specific Field',
            type: 'String'
        });
    }
    
    return properties;
}
```

### Complex Validation Rules

Implement multi-field validation:

```javascript
@api
validate() {
    const errors = [];
    
    // Basic validation
    if (!this.selectedObject) {
        errors.push({
            key: 'OBJECT_REQUIRED',
            errorString: 'Object selection is required'
        });
    }
    
    // Conditional validation
    if (this.requiresField && !this.selectedField) {
        errors.push({
            key: 'FIELD_REQUIRED',
            errorString: 'Field selection is required when "Requires Field" is checked'
        });
    }
    
    // Cross-field validation
    if (this.selectedObject === 'Account' && this.selectedField === 'Name') {
        errors.push({
            key: 'INVALID_COMBINATION',
            errorString: 'Account Name field is not supported for this operation'
        });
    }
    
    return errors;
}
```

### Performance Optimization

Optimize for large metadata sets:

```javascript
// Cache frequently used data
_objectCache = new Map();

async getObjectMetadata(objectName) {
    if (this._objectCache.has(objectName)) {
        return this._objectCache.get(objectName);
    }
    
    const metadata = await fetchObjectMetadata(objectName);
    this._objectCache.set(objectName, metadata);
    return metadata;
}

// Debounce rapid changes
handleSearchInput = this.debounce((searchTerm) => {
    this.performSearch(searchTerm);
}, 300);

debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
```

### Integration with External Services

Fetch configuration from external sources:

```javascript
async loadExternalConfiguration() {
    try {
        const response = await fetch('/api/configuration');
        const config = await response.json();
        
        this.applyExternalConfig(config);
    } catch (error) {
        console.error('Failed to load external config:', error);
        // Fall back to default configuration
    }
}
```

## Conclusion

Custom Property Editors are powerful tools for creating intuitive configuration experiences in Salesforce Flow Builder. By following the patterns and best practices outlined in this guide, you can create CPEs that are:

- **Intuitive**: Progressive disclosure and clear UI patterns
- **Reliable**: Proper error handling and fallback strategies
- **Performant**: Efficient data loading and caching
- **Maintainable**: Clear code structure and documentation

Remember to:
1. Always handle errors gracefully
2. Provide loading indicators for async operations
3. Dispatch events immediately on user changes
4. Support both direct values and Flow variable references
5. Implement comprehensive validation
6. Test thoroughly in Flow Builder context

For the latest updates and additional resources, refer to the official Salesforce documentation and the Lightning Web Components developer guide.