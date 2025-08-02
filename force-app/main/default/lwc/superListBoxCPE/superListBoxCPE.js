import { LightningElement, api, track, wire } from 'lwc';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import getObjectOptions from '@salesforce/apex/SuperListBoxController.getObjectOptions';
import getPicklistFields from '@salesforce/apex/SuperListBoxController.getPicklistFields';

export default class SuperListBoxCPE extends LightningElement {
    // Flow Builder interfaces
    _builderContext = {};
    _inputVariables = [];
    _genericTypeMappings = [];
    _automaticOutputVariables = [];
    
    @track objectOptions = [];
    @track fieldOptions = [];
    @track picklistValues = [];
    @track customDefinitions = {};
    @track customIcons = {};
    @track showPicklistDefinitions = false;
    @track isLoadingObjects = false;
    @track isLoadingFields = false;
    @track showIconPickerModal = false;
    @track currentPicklistValueForIcon = null;
    @track currentIconForPicker = null;
    
    selectedObject;
    selectedField;
    selectedRecordTypeId;
    cardTitle = 'Select Values';
    isRequired = false;
    initialSelectedValues = [];
    _initialSelectedValuesForCombobox = ''; // Private property
    helpTextDisplayMode = 'bubble'; // 'bubble' or 'subtitle'
    enableOptionIcons = false;
    
    // Track whether initialSelectedValues is a collection
    @track initialSelectedValuesIsCollection = true;
    
    constructor() {
        super();
        // Ensure all arrays are initialized
        this._inputVariables = [];
        this._genericTypeMappings = [];
        this._automaticOutputVariables = [];
        this.initialSelectedValues = [];
        this.objectOptions = [];
        this.fieldOptions = [];
        this.picklistValues = [];
        this.customDefinitions = {};
    }
    
    // Getter to ensure we always return a valid string
    get initialSelectedValuesForCombobox() {
        // Ensure initialSelectedValues is always an array
        if (!this.initialSelectedValues) {
            this.initialSelectedValues = [];
        }
        
        // If the stored combobox value is an array, join it
        if (Array.isArray(this._initialSelectedValuesForCombobox)) {
            return this._initialSelectedValuesForCombobox.join(',');
        }
        return this._initialSelectedValuesForCombobox || '';
    }
    
    set initialSelectedValuesForCombobox(value) {
        if (Array.isArray(value)) {
            this._initialSelectedValuesForCombobox = value.join(',');
        } else {
            this._initialSelectedValuesForCombobox = value || '';
        }
    }
    
    effectiveRecordTypeId = null;
    _picklistData = null; // Store picklist data from wire
    
    get isBubbleMode() {
        return this.helpTextDisplayMode === 'bubble';
    }
    
    get isSubtitleMode() {
        return this.helpTextDisplayMode === 'subtitle';
    }
    
    get bubbleButtonVariant() {
        return this.isBubbleMode ? 'brand' : 'neutral';
    }
    
    get subtitleButtonVariant() {
        return this.isSubtitleMode ? 'brand' : 'neutral';
    }

    connectedCallback() {
        // Ensure arrays are initialized before loading
        if (!this.objectOptions) this.objectOptions = [];
        if (!this.fieldOptions) this.fieldOptions = [];
        if (!this.picklistValues) this.picklistValues = [];
        if (!this.initialSelectedValues) this.initialSelectedValues = [];
        if (!this.customDefinitions) this.customDefinitions = {};
        if (!this._automaticOutputVariables) this._automaticOutputVariables = [];
        
        // Load objects when component is connected
        this.loadObjectOptions();
    }

    @api
    get builderContext() {
        return this._builderContext || {};
    }
    set builderContext(context) {
        this._builderContext = context || {};
        console.log('Full builderContext received:', JSON.stringify(context, null, 2));
        console.log('Context keys:', context ? Object.keys(context) : 'No context');
        
        // Try to log nested properties
        if (context) {
            try {
                console.log('Context properties:', {
                    hasObjectInfos: !!context.objectInfos,
                    hasFlowInfo: !!context.flowInfo,
                    hasElementInfos: !!context.elementInfos,
                    hasVariables: !!context.variables,
                    hasFormulas: !!context.formulas
                });
            } catch (e) {
                console.log('Error accessing context properties:', e);
            }
        }
        
        this.loadObjectOptions();
    }
    
    @api
    get inputVariables() {
        return this._inputVariables || [];
    }
    set inputVariables(variables) {
        this._inputVariables = variables || [];
        this.initializeValues();
    }
    
    @api
    get genericTypeMappings() {
        return this._genericTypeMappings || [];
    }
    set genericTypeMappings(mappings) {
        this._genericTypeMappings = mappings || [];
        this.initializeGenericType();
    }

    @api
    get automaticOutputVariables() {
        return this._automaticOutputVariables || [];
    }
    set automaticOutputVariables(variables) {
        this._automaticOutputVariables = variables || [];
        console.log('automaticOutputVariables set:', this._automaticOutputVariables);
    }

    initializeValues() {
        console.log('Initializing values from inputVariables:', this._inputVariables);
        
        // Store field value to set after options load
        let fieldToSet = null;
        
        if (this._inputVariables && Array.isArray(this._inputVariables)) {
            this._inputVariables.forEach(variable => {
                switch (variable.name) {
                    case 'objectApiName':
                        // Set from input variables if no generic type mapping exists
                        if (!this.selectedObject && variable.value) {
                            this.selectedObject = variable.value;
                        }
                        break;
                    case 'fieldApiName':
                        fieldToSet = variable.value;
                        console.log('CPE - Found fieldApiName in inputVariables:', fieldToSet);
                        break;
                    case 'recordTypeId':
                        this.selectedRecordTypeId = variable.value;
                        break;
                    case 'cardTitle':
                        this.cardTitle = variable.value || 'Select Values';
                        break;
                    case 'isRequired':
                        this.isRequired = variable.value === 'true' || variable.value === true;
                        break;
                    case 'initialSelectedValues':
                        // Handle various input formats for initialSelectedValues
                        console.log('CPE - Received initialSelectedValues:', variable.value, 'Type:', typeof variable.value);
                        
                        if (!variable.value) {
                            this.initialSelectedValues = [];
                            this._initialSelectedValuesForCombobox = '';
                        } else if (typeof variable.value === 'string') {
                            // Check if it's a Flow variable reference
                            if (variable.value.startsWith('{!') && variable.value.endsWith('}')) {
                                // This is a Flow variable reference - display it as is
                                this._initialSelectedValuesForCombobox = variable.value;
                                this.initialSelectedValues = []; // Don't try to process the reference
                            } else {
                                // Store the string value for combobox
                                this._initialSelectedValuesForCombobox = variable.value;
                                // Split comma-separated values
                                try {
                                    this.initialSelectedValues = variable.value.split(',').map(v => v.trim()).filter(v => v);
                                } catch (e) {
                                    console.error('Error splitting initial values:', e);
                                    this.initialSelectedValues = variable.value ? [variable.value] : [];
                                }
                            }
                        } else if (Array.isArray(variable.value)) {
                            // This is already an array from Flow
                            this.initialSelectedValues = [...variable.value];
                            this._initialSelectedValuesForCombobox = variable.value.join(',');
                        } else {
                            // Convert other types to string
                            const stringValue = String(variable.value);
                            this.initialSelectedValues = [stringValue];
                            this._initialSelectedValuesForCombobox = stringValue;
                        }
                        
                        console.log('CPE - Processed initialSelectedValues:', this.initialSelectedValues);
                        console.log('CPE - Processed initialSelectedValuesForCombobox:', this._initialSelectedValuesForCombobox);
                        break;
                    case 'picklistDefinitions':
                        try {
                            this.customDefinitions = JSON.parse(variable.value || '{}');
                        } catch (e) {
                            this.customDefinitions = {};
                        }
                        break;
                    case 'helpTextDisplayMode':
                        this.helpTextDisplayMode = variable.value || 'bubble';
                        break;
                    case 'picklistIcons':
                        try {
                            this.customIcons = JSON.parse(variable.value || '{}');
                        } catch (e) {
                            this.customIcons = {};
                        }
                        break;
                    case 'enableOptionIcons':
                        this.enableOptionIcons = variable.value === 'true' || variable.value === true;
                        break;
                }
            });
        }
        
        // If we have both object and field, load the field options
        if (this.selectedObject) {
            // Pass the field to set after loading
            this.loadFieldOptions(fieldToSet);
        } else if (fieldToSet) {
            // If no object but field is set, store it for later
            this.selectedField = fieldToSet;
        }
    }
    
    initializeGenericType() {
        // Not using generic types in this implementation
        // This method is kept for compatibility but does nothing
    }

    async loadObjectOptions() {
        console.log('Loading object options using Apex');
        this.isLoadingObjects = true;
        
        try {
            const options = await getObjectOptions();
            this.objectOptions = options || [];
            console.log('Loaded object options from Apex:', this.objectOptions.length);
        } catch (error) {
            console.error('Error loading object options from Apex:', error);
            // Use fallback if Apex fails
            this.loadFallbackObjectOptions();
        } finally {
            this.isLoadingObjects = false;
        }
    }
    
    loadFallbackObjectOptions() {
        // Provide common Salesforce objects as fallback
        this.objectOptions = [
            { label: 'Account', value: 'Account' },
            { label: 'Contact', value: 'Contact' },
            { label: 'Opportunity', value: 'Opportunity' },
            { label: 'Lead', value: 'Lead' },
            { label: 'Case', value: 'Case' },
            { label: 'Campaign', value: 'Campaign' },
            { label: 'User', value: 'User' },
            { label: 'Task', value: 'Task' },
            { label: 'Event', value: 'Event' },
            { label: 'Product2', value: 'Product2' },
            { label: 'Pricebook2', value: 'Pricebook2' },
            { label: 'Order', value: 'Order' },
            { label: 'Contract', value: 'Contract' },
            { label: 'Asset', value: 'Asset' }
        ].sort((a, b) => a.label.localeCompare(b.label));
        
        console.log('Using fallback object options');
    }

    async loadFieldOptions(fieldToSet) {
        console.log('Loading field options for object:', this.selectedObject, 'fieldToSet:', fieldToSet);
        
        if (!this.selectedObject) {
            this.fieldOptions = [];
            return;
        }
        
        // Use passed field or current field selection
        const savedFieldSelection = fieldToSet || this.selectedField;
        this.isLoadingFields = true;
        
        try {
            const fields = await getPicklistFields({ objectApiName: this.selectedObject });
            // Filter to only show multi-select picklist fields
            this.fieldOptions = (fields || []).filter(field => field.isMultiSelect === true);
            console.log('Loaded multi-select field options from Apex:', this.fieldOptions.length);
            
            // Set the field selection if it's valid
            if (savedFieldSelection) {
                const fieldStillExists = this.fieldOptions.some(field => field.value === savedFieldSelection);
                if (fieldStillExists) {
                    this.selectedField = savedFieldSelection;
                    console.log('CPE - Set field selection:', this.selectedField);
                    
                    // If we already have picklist data, process it now
                    if (this._picklistData) {
                        this.processPicklistValues(this._picklistData);
                    }
                } else {
                    console.log('CPE - Field no longer exists:', savedFieldSelection);
                    this.selectedField = null;
                    this.picklistValues = [];
                    this.showPicklistDefinitions = false;
                    this.dispatchConfigurationChange('fieldApiName', null);
                }
            }
        } catch (error) {
            console.error('Error loading field options from Apex:', error);
            this.fieldOptions = [];
        } finally {
            this.isLoadingFields = false;
        }
    }

    @wire(getObjectInfo, { objectApiName: '$selectedObject' })
    objectInfo({ error, data }) {
        if (data) {
            this.effectiveRecordTypeId = this.selectedRecordTypeId || data.defaultRecordTypeId;
            console.log('Got object info, effectiveRecordTypeId:', this.effectiveRecordTypeId);
            // The picklist values wire will automatically trigger when effectiveRecordTypeId changes
        } else if (error) {
            console.error('Error fetching object info:', error);
        }
    }

    @wire(getPicklistValuesByRecordType, { 
        objectApiName: '$selectedObject', 
        recordTypeId: '$effectiveRecordTypeId' 
    })
    wiredPicklistValues({ error, data }) {
        console.log('Wired picklist values - data:', data, 'selectedField:', this.selectedField);
        
        if (data) {
            // Store the data for later use
            this._picklistData = data;
            this.processPicklistValues(data);
        } else if (error) {
            console.error('Error fetching picklist values:', error);
            this._picklistData = null;
            this.picklistValues = [];
            this.showPicklistDefinitions = false;
        }
    }
    
    processPicklistValues(data) {
        if (data && this.selectedField) {
            // Check if the field exists in the picklist field values
            if (data.picklistFieldValues && data.picklistFieldValues[this.selectedField]) {
                const fieldData = data.picklistFieldValues[this.selectedField];
                this.picklistValues = fieldData.values.map((item) => ({
                    label: item.label,
                    value: item.value,
                    definition: this.customDefinitions[item.value] || '',
                    icon: this.customIcons[item.value] || ''
                }));
                this.showPicklistDefinitions = true;
                console.log('Loaded picklist values:', this.picklistValues.length);
            } else {
                console.log('Field not found in picklistFieldValues');
                this.picklistValues = [];
                this.showPicklistDefinitions = false;
            }
        } else if (!this.selectedField) {
            // No field selected yet
            this.picklistValues = [];
            this.showPicklistDefinitions = false;
        }
    }

    handleObjectChange(event) {
        this.selectedObject = event.detail.value;
        this.selectedField = null;
        this.fieldOptions = [];
        this.picklistValues = [];
        this.showPicklistDefinitions = false;
        
        // Update input variable
        this.dispatchConfigurationChange('objectApiName', this.selectedObject);
        
        // Load field options after object change (no field to restore)
        this.loadFieldOptions(null);
    }

    handleFieldChange(event) {
        this.selectedField = event.detail.value;
        console.log('Field changed to:', this.selectedField);
        this.dispatchConfigurationChange('fieldApiName', this.selectedField);
        
        // Clear existing picklist values
        this.picklistValues = [];
        this.showPicklistDefinitions = false;
        
        // Force re-evaluation of picklist values
        // Since the wire doesn't watch selectedField, we need to manually process
        if (this._picklistData && this.selectedField) {
            this.processPicklistValues(this._picklistData);
        }
    }

    handleRecordTypeIdChange(event) {
        this.selectedRecordTypeId = event.detail.value;
        this.dispatchConfigurationChange('recordTypeId', this.selectedRecordTypeId);
    }

    handleCardTitleChange(event) {
        this.cardTitle = event.detail.value;
        this.dispatchConfigurationChange('cardTitle', this.cardTitle);
    }

    handleIsRequiredChange(event) {
        this.isRequired = event.detail.checked;
        this.dispatchConfigurationChange('isRequired', this.isRequired);
    }
    
    handleBubbleModeClick() {
        this.helpTextDisplayMode = 'bubble';
        this.dispatchConfigurationChange('helpTextDisplayMode', this.helpTextDisplayMode);
    }
    
    handleSubtitleModeClick() {
        this.helpTextDisplayMode = 'subtitle';
        this.dispatchConfigurationChange('helpTextDisplayMode', this.helpTextDisplayMode);
    }
    
    handleEnableOptionIconsChange(event) {
        this.enableOptionIcons = event.detail.checked;
        this.dispatchConfigurationChange('enableOptionIcons', this.enableOptionIcons);
    }
    
    handleIconChange(event) {
        const picklistValue = event.target.dataset.value;
        const icon = event.detail.value;
        
        // Update the custom icons
        this.customIcons[picklistValue] = icon;
        
        // Update the picklist values array to trigger re-render
        this.picklistValues = this.picklistValues.map(item => {
            if (item.value === picklistValue) {
                return { ...item, icon: icon };
            }
            return item;
        });
        
        // Dispatch immediately
        const iconsJson = JSON.stringify(this.customIcons);
        console.log('CPE - Dispatching picklistIcons:', iconsJson);
        this.dispatchConfigurationChange('picklistIcons', iconsJson);
    }
    
    handleOpenIconPicker(event) {
        this.currentPicklistValueForIcon = event.target.dataset.value;
        // Get the current icon for this picklist value
        this.currentIconForPicker = this.customIcons[this.currentPicklistValueForIcon] || '';
        this.showIconPickerModal = true;
    }
    
    handleCloseIconPicker() {
        this.showIconPickerModal = false;
        this.currentPicklistValueForIcon = null;
        this.currentIconForPicker = null;
    }
    
    handleIconSelection(event) {
        // The fsc_pickIcon component dispatches an event with the selected icon
        const selectedIcon = event.detail.value || event.detail;
        
        if (this.currentPicklistValueForIcon && selectedIcon) {
            // Update the custom icons
            this.customIcons[this.currentPicklistValueForIcon] = selectedIcon;
            
            // Update the picklist values array to trigger re-render
            this.picklistValues = this.picklistValues.map(item => {
                if (item.value === this.currentPicklistValueForIcon) {
                    return { ...item, icon: selectedIcon };
                }
                return item;
            });
            
            // Dispatch the update
            const iconsJson = JSON.stringify(this.customIcons);
            console.log('CPE - Dispatching picklistIcons from picker:', iconsJson);
            this.dispatchConfigurationChange('picklistIcons', iconsJson);
        }
        
        // Close the modal
        this.handleCloseIconPicker();
    }

    handleInitialSelectedValuesChange(event) {
        // Handle the value from flow combobox - it could be a string, array, or null
        // stringArrayCombobox sends the value directly in event.detail
        let value = event.detail;
        
        console.log('handleInitialSelectedValuesChange received:', value, 'Type:', typeof value);
        
        // Check if it's a Flow variable reference
        if (typeof value === 'string' && value.startsWith('{!') && value.endsWith('}')) {
            // This is a Flow variable reference - keep it as is
            this._initialSelectedValuesForCombobox = value;
            // For Flow Builder, dispatch the variable reference directly
            // The Flow Builder will handle resolving this to the actual collection variable
            this.dispatchConfigurationChange('initialSelectedValues', value);
            console.log('CPE - Dispatching Flow variable reference:', value);
        } else if (value === null || value === undefined || value === '') {
            this.initialSelectedValues = [];
            this._initialSelectedValuesForCombobox = '';
            // Empty array for initialSelectedValues
            this.dispatchConfigurationChange('initialSelectedValues', '');
        } else if (typeof value === 'string') {
            // If it's a comma-separated string, keep it as a string
            // Flow Builder will handle the conversion to array if needed
            this._initialSelectedValuesForCombobox = value;
            this.dispatchConfigurationChange('initialSelectedValues', value);
        } else if (Array.isArray(value)) {
            // If it's already an array, join it to a comma-separated string
            this.initialSelectedValues = [...value];
            const stringValue = value.join(',');
            this._initialSelectedValuesForCombobox = stringValue;
            this.dispatchConfigurationChange('initialSelectedValues', stringValue);
        } else {
            // Handle other types by converting to string first
            const stringValue = String(value);
            this.initialSelectedValues = [stringValue];
            this._initialSelectedValuesForCombobox = stringValue;
            this.dispatchConfigurationChange('initialSelectedValues', stringValue);
        }
    }

    handleDefinitionChange(event) {
        const picklistValue = event.target.dataset.value;
        const definition = event.detail.value;
        
        // Update the custom definitions
        this.customDefinitions[picklistValue] = definition;
        
        // Update the picklist values array to trigger re-render
        this.picklistValues = this.picklistValues.map(item => {
            if (item.value === picklistValue) {
                return { ...item, definition: definition };
            }
            return item;
        });
        
        // Dispatch immediately
        const definitionsJson = JSON.stringify(this.customDefinitions);
        console.log('CPE - Dispatching picklistDefinitions:', definitionsJson);
        this.dispatchConfigurationChange('picklistDefinitions', definitionsJson);
    }

    dispatchConfigurationChange(name, value) {
        const valueChangeEvent = new CustomEvent('configuration_editor_input_value_changed', {
            bubbles: true,
            cancelable: false,
            composed: true,
            detail: {
                name: name,
                newValue: value,
                newValueDataType: this.getDataType(name)
            }
        });
        this.dispatchEvent(valueChangeEvent);
    }

    dispatchGenericTypeChange(genericTypeMapping) {
        const genericTypeEvent = new CustomEvent('configuration_editor_generic_type_mapping_changed', {
            bubbles: true,
            cancelable: false,
            composed: true,
            detail: {
                typeName: genericTypeMapping.typeName,
                typeValue: genericTypeMapping.typeValue
            }
        });
        this.dispatchEvent(genericTypeEvent);
    }

    getDataType(name) {
        switch (name) {
            case 'isRequired':
            case 'enableOptionIcons':
                return 'Boolean';
            case 'selectedAsCollection':
                return 'String[]';
            case 'initialSelectedValues':
                // Check the current value being used, not the input variable
                const currentValue = this._initialSelectedValuesForCombobox;
                if (typeof currentValue === 'string' && currentValue.startsWith('{!') && currentValue.endsWith('}')) {
                    return 'reference';
                }
                // Otherwise return String[] to match the metadata definition
                return 'String[]';
            default:
                return 'String';
        }
    }

}