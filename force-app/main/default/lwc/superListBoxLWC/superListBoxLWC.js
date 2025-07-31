import { LightningElement, api, track, wire } from 'lwc';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';

export default class SuperListBoxLWC extends LightningElement {
    @api recordTypeId; // Optional Input: Record Type ID
    @api isRequired = false;
    
    _picklistDefinitions;
    @api 
    get picklistDefinitions() {
        return this._picklistDefinitions;
    }
    set picklistDefinitions(value) {
        console.log('SuperListBoxLWC - picklistDefinitions setter called with:', value);
        this._picklistDefinitions = value;
        this.parseDefinitions();
        
        // Update options with help text if we already have picklist options
        if (this.picklistOptions && this.picklistOptions.length > 0) {
            this.updatePicklistOptionsWithHelp();
        }
        
        // Increment key to force complete re-render
        this.componentKey++;
        
        console.log('SuperListBoxLWC - picklistDefinitions updated');
    }

    _objectApiName;
    @api
    get objectApiName() {
        return this._objectApiName;
    }
    set objectApiName(value) {
        this._objectApiName = value;
        this.updatePicklistParams();
    }

    _fieldApiName;
    @api
    get fieldApiName() {
        return this._fieldApiName;
    }
    set fieldApiName(value) {
        this._fieldApiName = value;
        this.updatePicklistParams();
    }

    _initialSelectedValues = []; // Internal storage as array
    @api 
    get initialSelectedValues() {
        return this._initialSelectedValues;
    }
    set initialSelectedValues(value) {
        console.log('SuperListBoxLWC - initialSelectedValues setter called with:', value, 'Type:', typeof value);
        
        if (!value) {
            this._initialSelectedValues = [];
            this.selectedValues = [];
        } else if (Array.isArray(value)) {
            this._initialSelectedValues = value;
            this.selectedValues = [...value];
        } else if (typeof value === 'string') {
            // Handle string input (shouldn't happen with String[] type, but be defensive)
            if (value.includes(',')) {
                const arr = value.split(',').map(v => v.trim()).filter(v => v);
                this._initialSelectedValues = arr;
                this.selectedValues = arr;
            } else {
                this._initialSelectedValues = [value];
                this.selectedValues = [value];
            }
        } else {
            this._initialSelectedValues = [];
            this.selectedValues = [];
        }
        
        console.log('SuperListBoxLWC - After processing, selectedValues:', this.selectedValues);
    }
    @api selectedAsString; // Output: Selected values as string
    @api selectedAsCollection; // Output: Selected values as collection
    @api cardTitle = 'Select Values';

    @track picklistOptions = []; // Options for dual listbox
    @track _selectedValues = []; // Internal selected values
    @track picklistOptionsWithHelp = []; // Options with help text
    @track parsedDefinitions = {}; // Parsed custom definitions
    @track componentKey = 0; // Key to force re-render
    @track showCustomUI = false; // Simple flag for UI switching

    // Getter to ensure selectedValues is always an array
    get selectedValues() {
        return Array.isArray(this._selectedValues) ? this._selectedValues : [];
    }
    
    set selectedValues(value) {
        if (Array.isArray(value)) {
            this._selectedValues = [...value];
        } else if (typeof value === 'string' && value) {
            this._selectedValues = value.split(';').filter(v => v && v.trim() !== '');
        } else {
            this._selectedValues = [];
        }
    }

    effectiveRecordTypeId = null;
    @track picklistParams = {};

    connectedCallback() {
        console.log('SuperListBoxLWC - connectedCallback', {
            objectApiName: this._objectApiName,
            fieldApiName: this._fieldApiName,
            picklistDefinitions: this._picklistDefinitions,
            recordTypeId: this.recordTypeId,
            initialSelectedValues: this._initialSelectedValues,
            typeOfInitialSelectedValues: typeof this._initialSelectedValues
        });
        
        // selectedValues already set by setter, just log for debugging
        console.log('SuperListBoxLWC - selectedValues after init:', this.selectedValues);
        
        this.parseDefinitions();
    }

    parseDefinitions() {
        if (this._picklistDefinitions) {
            try {
                this.parsedDefinitions = JSON.parse(this._picklistDefinitions);
            } catch (e) {
                console.error('Error parsing picklist definitions:', e);
                this.parsedDefinitions = {};
            }
        } else {
            this.parsedDefinitions = {};
        }
    }

    updatePicklistOptionsWithHelp() {
        if (this.picklistOptions) {
            this.picklistOptionsWithHelp = this.picklistOptions.map((item) => {
                const helpText = this.parsedDefinitions[item.value];
                return { 
                    label: item.label, 
                    value: item.value,
                    helpText: helpText || '',
                    hasHelp: !!helpText
                };
            });
            
            // Update showCustomUI based on whether we have any help text
            const hasAnyHelpText = this.picklistOptionsWithHelp.some(opt => opt.hasHelp);
            this.showCustomUI = hasAnyHelpText;
            console.log('SuperListBoxLWC - updatePicklistOptionsWithHelp - hasAnyHelpText:', hasAnyHelpText);
        }
    }

    // Fetch object info to get default record type if recordTypeId is not provided
    @wire(getObjectInfo, { objectApiName: '$_objectApiName' })
    objectInfo({ error, data }) {
        console.log('SuperListBoxLWC - objectInfo wire called', {
            data: data,
            error: error,
            objectApiName: this._objectApiName
        });
        
        if (data) {
            console.log('SuperListBoxLWC - Object Info Data:', data);
            this.effectiveRecordTypeId = this.recordTypeId || data.defaultRecordTypeId;
            console.log('SuperListBoxLWC - Using Record Type ID:', this.effectiveRecordTypeId);
            this.updatePicklistParams();
        } else if (error) {
            console.error('SuperListBoxLWC - Error fetching object info:', error);
        }
    }

    updatePicklistParams() {
        console.log('SuperListBoxLWC - updatePicklistParams', {
            effectiveRecordTypeId: this.effectiveRecordTypeId,
            objectApiName: this._objectApiName,
            fieldApiName: this._fieldApiName
        });
        
        if (this.effectiveRecordTypeId && this._objectApiName && this._fieldApiName) {
            this.picklistParams = {
                objectApiName: this._objectApiName,
                recordTypeId: this.effectiveRecordTypeId
            };
            console.log('SuperListBoxLWC - picklistParams set:', this.picklistParams);
        }
    }
    // Fetch picklist values for the given object and record type
    @wire(getPicklistValuesByRecordType, { objectApiName: '$_objectApiName', recordTypeId: '$effectiveRecordTypeId' })
    wiredPicklistValues({ error, data }) {
        console.log('SuperListBoxLWC - wiredPicklistValues called', {
            data: data,
            error: error,
            fieldApiName: this._fieldApiName,
            picklistParams: this.picklistParams
        });
        
        if (data) {
            if (this._fieldApiName && data.picklistFieldValues && data.picklistFieldValues[this._fieldApiName]) {
                const fieldData = data.picklistFieldValues[this._fieldApiName];
                console.log('SuperListBoxLWC - Found field data:', fieldData);
                
                this.picklistOptions = fieldData.values.map((item) => {
                    return { label: item.label, value: item.value };
                });

                // Parse definitions if updated
                this.parseDefinitions();

                // Create options with help text
                this.picklistOptionsWithHelp = fieldData.values.map((item) => {
                    const helpText = this.parsedDefinitions[item.value];
                    return { 
                        label: item.label, 
                        value: item.value,
                        helpText: helpText || '',
                        hasHelp: !!helpText
                    };
                });
                
                // Update UI flag based on whether we have any help text
                const hasAnyHelpText = this.picklistOptionsWithHelp.some(opt => opt.hasHelp);
                this.showCustomUI = hasAnyHelpText;
                
                console.log('SuperListBoxLWC - picklistOptions:', this.picklistOptions);
                console.log('SuperListBoxLWC - showCustomUI:', this.showCustomUI);

                // Set selected values if initialSelectedValues are provided
                if (this.initialSelectedValues && this.selectedValues.length > 0) {
                    // Update outputs
                    this.selectedAsString = this.selectedValues.join(';');
                    this.selectedAsCollection = [...this.selectedValues];

                    // Dispatch Flow Attribute Change Events
                    this.dispatchFlowAttributeChangeEvent('selectedAsString', this.selectedAsString);
                    this.dispatchFlowAttributeChangeEvent('selectedAsCollection', this.selectedAsCollection);
                }
            } else {
                console.warn(`Field "${this._fieldApiName}" not found in picklistFieldValues.`);
            }
        } else if (error) {
            console.error('Error fetching picklist values:', error);
        }
    }

    // Handle selection change in the dual listbox
    handleSelectionChange(event) {
        this.selectedValues = event.detail.value;
        this.selectedAsString = this.selectedValues.join(';');
        this.selectedAsCollection = [...this.selectedValues];

        // Dispatch Flow Attribute Change Events
        this.dispatchFlowAttributeChangeEvent('selectedAsString', this.selectedAsString);
        this.dispatchFlowAttributeChangeEvent('selectedAsCollection', this.selectedAsCollection);
    }

    // Dispatch Flow Attribute Change Event
    dispatchFlowAttributeChangeEvent(attributeName, attributeValue) {
        const attributeChangeEvent = new FlowAttributeChangeEvent(attributeName, attributeValue);
        this.dispatchEvent(attributeChangeEvent);
    }

    @api
    validate() {
        // If isRequired is falsy (null, false, undefined), everything is valid
        if (!this.isRequired) {
            return { isValid: true };
        }

        // If isRequired is true, at least one value must be selected
        if (this.selectedValues && this.selectedValues.length > 0) {
            return { isValid: true };
        } else {
            return {
                isValid: false,
                errorMessage: 'Please select at least one value.'
            };
        }
    }

    // Custom dual listbox functionality
    @track clickedAvailable = [];
    @track clickedSelected = [];

    get hasCustomDefinitions() {
        const hasDefinitions = this._picklistDefinitions && 
               this.parsedDefinitions && 
               Object.keys(this.parsedDefinitions).length > 0 &&
               this.picklistOptionsWithHelp && 
               this.picklistOptionsWithHelp.some(opt => opt.hasHelp);
        
        console.log('SuperListBoxLWC - hasCustomDefinitions:', hasDefinitions, {
            picklistDefinitions: this._picklistDefinitions,
            parsedDefinitions: this.parsedDefinitions,
            hasHelpText: this.picklistOptionsWithHelp?.some(opt => opt.hasHelp)
        });
        
        return hasDefinitions;
    }

    get availableOptions() {
        if (!this.showCustomUI) return [];
        return this.picklistOptionsWithHelp.filter(opt => 
            !this.selectedValues.includes(opt.value)
        ).map(opt => ({
            ...opt,
            selected: this.clickedAvailable.includes(opt.value)
        }));
    }

    get selectedOptions() {
        if (!this.showCustomUI) return [];
        return this.picklistOptionsWithHelp.filter(opt => 
            this.selectedValues.includes(opt.value)
        ).map(opt => ({
            ...opt,
            selected: this.clickedSelected.includes(opt.value)
        }));
    }

    get disableMoveToSelected() {
        return this.clickedAvailable.length === 0;
    }

    get disableMoveToAvailable() {
        return this.clickedSelected.length === 0;
    }

    handleAvailableClick(event) {
        const value = event.currentTarget.dataset.value;
        const optionElement = event.currentTarget;
        
        if (this.clickedAvailable.includes(value)) {
            this.clickedAvailable = this.clickedAvailable.filter(v => v !== value);
            optionElement.classList.remove('selected');
        } else {
            this.clickedAvailable = [...this.clickedAvailable, value];
            optionElement.classList.add('selected');
        }
    }

    handleSelectedClick(event) {
        const value = event.currentTarget.dataset.value;
        const optionElement = event.currentTarget;
        
        if (this.clickedSelected.includes(value)) {
            this.clickedSelected = this.clickedSelected.filter(v => v !== value);
            optionElement.classList.remove('selected');
        } else {
            this.clickedSelected = [...this.clickedSelected, value];
            optionElement.classList.add('selected');
        }
    }

    moveToSelected() {
        if (this.clickedAvailable.length > 0) {
            this.selectedValues = [...this.selectedValues, ...this.clickedAvailable];
            this.clickedAvailable = [];
            this.updateOutputValues();
        }
    }

    moveToAvailable() {
        if (this.clickedSelected.length > 0) {
            this.selectedValues = this.selectedValues.filter(v => 
                !this.clickedSelected.includes(v)
            );
            this.clickedSelected = [];
            this.updateOutputValues();
        }
    }

    updateOutputValues() {
        this.selectedAsString = this.selectedValues.join(';');
        this.selectedAsCollection = [...this.selectedValues];

        // Dispatch Flow Attribute Change Events
        this.dispatchFlowAttributeChangeEvent('selectedAsString', this.selectedAsString);
        this.dispatchFlowAttributeChangeEvent('selectedAsCollection', this.selectedAsCollection);
    }
}