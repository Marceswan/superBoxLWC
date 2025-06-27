import { LightningElement, api, track, wire } from 'lwc';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';

export default class SuperListBoxCPE extends LightningElement {
    // Flow Builder interfaces
    _builderContext = {};
    _inputVariables = [];
    _genericTypeMappings = [];
    
    @track objectOptions = [];
    @track fieldOptions = [];
    @track picklistValues = [];
    @track customDefinitions = {};
    @track showPicklistDefinitions = false;
    
    selectedObject;
    selectedField;
    selectedRecordTypeId;
    cardTitle = 'Select Values';
    isRequired = false;
    initialSelectedValues = [];
    
    effectiveRecordTypeId = null;

    @api
    get builderContext() {
        return this._builderContext;
    }
    set builderContext(context) {
        this._builderContext = context || {};
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
        
        if (this._inputVariables && Array.isArray(this._inputVariables)) {
            this._inputVariables.forEach(variable => {
                switch (variable.name) {
                    case 'objectApiName':
                        // Don't set from here if we have generic type mapping
                        if (!this.selectedObject) {
                            this.selectedObject = variable.value;
                        }
                        break;
                    case 'fieldApiName':
                        this.selectedField = variable.value;
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
                        this.initialSelectedValues = variable.value || [];
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
        
        if (this.selectedObject) {
            this.loadFieldOptions();
        }
    }
    
    initializeGenericType() {
        // Get the current generic type mapping if it exists
        const typeMapping = this._genericTypeMappings?.find(mapping => mapping.typeName === 'T');
        if (typeMapping && typeMapping.typeValue) {
            this.selectedObject = typeMapping.typeValue;
            this.loadFieldOptions();
        }
    }

    loadObjectOptions() {
        console.log('Loading object options, builderContext:', this._builderContext);
        
        if (this._builderContext && this._builderContext.objectInfos) {
            this.objectOptions = Object.keys(this._builderContext.objectInfos)
                .map(objName => ({
                    label: this._builderContext.objectInfos[objName].label,
                    value: objName
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
                
            console.log('Loaded object options:', this.objectOptions);
        } else {
            console.log('No objectInfos available in builder context');
        }
    }

    loadFieldOptions() {
        console.log('Loading field options for object:', this.selectedObject);
        
        if (this._builderContext && this._builderContext.objectInfos && this.selectedObject) {
            const objectInfo = this._builderContext.objectInfos[this.selectedObject];
            if (objectInfo && objectInfo.fields) {
                this.fieldOptions = Object.keys(objectInfo.fields)
                    .filter(fieldName => {
                        const field = objectInfo.fields[fieldName];
                        return field.dataType === 'Picklist' || field.dataType === 'MultiPicklist';
                    })
                    .map(fieldName => ({
                        label: objectInfo.fields[fieldName].label,
                        value: fieldName
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label));
                    
                console.log('Loaded field options:', this.fieldOptions);
            }
        }
    }

    @wire(getObjectInfo, { objectApiName: '$selectedObject' })
    objectInfo({ error, data }) {
        if (data) {
            this.effectiveRecordTypeId = this.selectedRecordTypeId || data.defaultRecordTypeId;
            if (this.selectedField) {
                this.loadPicklistValues();
            }
        } else if (error) {
            console.error('Error fetching object info:', error);
        }
    }

    @wire(getPicklistValuesByRecordType, { 
        objectApiName: '$selectedObject', 
        recordTypeId: '$effectiveRecordTypeId' 
    })
    wiredPicklistValues({ error, data }) {
        if (data && this.selectedField && data.picklistFieldValues[this.selectedField]) {
            const fieldData = data.picklistFieldValues[this.selectedField];
            this.picklistValues = fieldData.values.map((item) => ({
                label: item.label,
                value: item.value,
                definition: this.customDefinitions[item.value] || ''
            }));
            this.showPicklistDefinitions = true;
        } else if (error) {
            console.error('Error fetching picklist values:', error);
        }
    }

    handleObjectChange(event) {
        this.selectedObject = event.detail.value;
        this.selectedField = null;
        this.fieldOptions = [];
        this.picklistValues = [];
        this.showPicklistDefinitions = false;
        
        this.loadFieldOptions();
        this.dispatchConfigurationChange('objectApiName', this.selectedObject);
        
        if (this.genericTypeMappings) {
            const genericTypeMapping = {
                typeName: 'T',
                typeValue: this.selectedObject
            };
            this.dispatchGenericTypeChange(genericTypeMapping);
        }
    }

    handleFieldChange(event) {
        this.selectedField = event.detail.value;
        this.dispatchConfigurationChange('fieldApiName', this.selectedField);
        
        if (this.selectedObject && this.effectiveRecordTypeId) {
            this.loadPicklistValues();
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
        
        this.customDefinitions[picklistValue] = definition;
        
        const definitionsJson = JSON.stringify(this.customDefinitions);
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
            case 'initialSelectedValues':
            case 'selectedAsCollection':
                return 'String[]';
            default:
                return 'String';
        }
    }

    loadPicklistValues() {
        // Trigger wire service by updating dependent properties
        if (this.selectedObject && this.selectedField && this.effectiveRecordTypeId) {
            // Wire service will handle loading
        }
    }
}