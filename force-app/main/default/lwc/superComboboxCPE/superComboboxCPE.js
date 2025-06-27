import { LightningElement, api, track, wire } from 'lwc';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import getObjectOptions from '@salesforce/apex/SuperListBoxController.getObjectOptions';
import getPicklistFields from '@salesforce/apex/SuperListBoxController.getPicklistFields';

export default class SuperComboboxCPE extends LightningElement {
    // Flow Builder interfaces
    _builderContext = {};
    _inputVariables = [];
    _genericTypeMappings = [];
    
    @track objectOptions = [];
    @track fieldOptions = [];
    @track picklistValues = [];
    @track customDefinitions = {};
    @track showPicklistDefinitions = false;
    @track isLoadingObjects = false;
    @track isLoadingFields = false;
    
    selectedObject;
    selectedField;
    selectedRecordTypeId;
    cardTitle = 'Select Value';
    isRequired = false;
    initialSelectedValue = '';
    
    effectiveRecordTypeId = null;
    _picklistData = null; // Store picklist data from wire

    connectedCallback() {
        // Load objects when component is connected
        this.loadObjectOptions();
    }

    @api
    get builderContext() {
        return this._builderContext;
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
                    hasVariables: !!context.variables
                });
            } catch (e) {
                console.log('Error accessing context properties:', e);
            }
        }
        
        this.loadObjectOptions();
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
    get genericTypeMappings() {
        return this._genericTypeMappings;
    }
    set genericTypeMappings(mappings) {
        this._genericTypeMappings = mappings || [];
        this.initializeGenericType();
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
                        this.cardTitle = variable.value || 'Select Value';
                        break;
                    case 'isRequired':
                        this.isRequired = variable.value === 'true' || variable.value === true;
                        break;
                    case 'initialSelectedValue':
                        this.initialSelectedValue = variable.value || '';
                        break;
                    case 'picklistDefinitions':
                        try {
                            this.customDefinitions = JSON.parse(variable.value || '{}');
                        } catch (e) {
                            this.customDefinitions = {};
                        }
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
            console.log('All fields from Apex:', fields);
            
            // Filter to only show single-select picklist fields (not multi-select)
            this.fieldOptions = (fields || []).filter(field => {
                console.log(`Field: ${field.label}, isMultiSelect: ${field.isMultiSelect}`);
                return field.isMultiSelect === false;
            });
            
            console.log('Filtered single-select picklist field options:', this.fieldOptions);
            console.log('Number of single-select fields:', this.fieldOptions.length);
            
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
                    definition: this.customDefinitions[item.value] || ''
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
                return 'Boolean';
            case 'initialSelectedValue':
                return 'String';
            default:
                return 'String';
        }
    }

}