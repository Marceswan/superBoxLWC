import { LightningElement, api, track, wire } from 'lwc';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';

export default class SuperComboboxLWC extends LightningElement {
    @api recordTypeId; // Optional Input: Record Type ID
    @api isRequired = false;
    
    _picklistDefinitions;
    @api 
    get picklistDefinitions() {
        return this._picklistDefinitions;
    }
    set picklistDefinitions(value) {
        console.log('SuperComboboxLWC - picklistDefinitions setter called with:', value);
        this._picklistDefinitions = value;
        this.parseDefinitions();
        
        // Update options with help text if we already have picklist options
        if (this.picklistOptions && this.picklistOptions.length > 0) {
            this.updatePicklistOptionsWithHelp();
        }
        
        // Update UI flag
        this.showCustomUI = !!(this._picklistDefinitions && 
                               this.parsedDefinitions && 
                               Object.keys(this.parsedDefinitions).length > 0);
        
        // Increment key to force complete re-render
        this.componentKey++;
        
        console.log('SuperComboboxLWC - Updated showCustomUI:', this.showCustomUI);
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

    @api initialSelectedValue; // New Input: Pre-selected value (single)
    @api selectedValue; // Output: Selected value as string
    @api cardTitle = 'Select Value';
    @api placeholder = 'Choose a value';

    @track picklistOptions = []; // Options for combobox
    @track selectedOption = ''; // Holds the selected value
    @track picklistOptionsWithHelp = []; // Options with help text
    @track parsedDefinitions = {}; // Parsed custom definitions
    @track componentKey = 0; // Key to force re-render
    @track showCustomUI = false; // Simple flag for UI switching

    effectiveRecordTypeId = null;
    @track picklistParams = {};

    connectedCallback() {
        console.log('SuperComboboxLWC - connectedCallback', {
            objectApiName: this._objectApiName,
            fieldApiName: this._fieldApiName,
            picklistDefinitions: this._picklistDefinitions,
            recordTypeId: this.recordTypeId
        });
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
        }
    }

    // Fetch object info to get default record type if recordTypeId is not provided
    @wire(getObjectInfo, { objectApiName: '$_objectApiName' })
    objectInfo({ error, data }) {
        console.log('SuperComboboxLWC - objectInfo wire called', {
            data: data,
            error: error,
            objectApiName: this._objectApiName
        });
        
        if (data) {
            console.log('SuperComboboxLWC - Object Info Data:', data);
            this.effectiveRecordTypeId = this.recordTypeId || data.defaultRecordTypeId;
            console.log('SuperComboboxLWC - Using Record Type ID:', this.effectiveRecordTypeId);
            this.updatePicklistParams();
        } else if (error) {
            console.error('SuperComboboxLWC - Error fetching object info:', error);
        }
    }

    updatePicklistParams() {
        console.log('SuperComboboxLWC - updatePicklistParams', {
            effectiveRecordTypeId: this.effectiveRecordTypeId,
            objectApiName: this._objectApiName,
            fieldApiName: this._fieldApiName
        });
        
        if (this.effectiveRecordTypeId && this._objectApiName && this._fieldApiName) {
            this.picklistParams = {
                objectApiName: this._objectApiName,
                recordTypeId: this.effectiveRecordTypeId
            };
            console.log('SuperComboboxLWC - picklistParams set:', this.picklistParams);
        }
    }
    
    // Fetch picklist values for the given object and record type
    @wire(getPicklistValuesByRecordType, { objectApiName: '$_objectApiName', recordTypeId: '$effectiveRecordTypeId' })
    wiredPicklistValues({ error, data }) {
        console.log('SuperComboboxLWC - wiredPicklistValues called', {
            data: data,
            error: error,
            fieldApiName: this._fieldApiName,
            picklistParams: this.picklistParams
        });
        
        if (data) {
            if (this._fieldApiName && data.picklistFieldValues && data.picklistFieldValues[this._fieldApiName]) {
                const fieldData = data.picklistFieldValues[this._fieldApiName];
                console.log('SuperComboboxLWC - Found field data:', fieldData);
                
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
                
                // Update UI flag after setting options
                this.showCustomUI = !!(this._picklistDefinitions && 
                                     this.parsedDefinitions && 
                                     Object.keys(this.parsedDefinitions).length > 0);
                
                console.log('SuperComboboxLWC - picklistOptions:', this.picklistOptions);
                console.log('SuperComboboxLWC - showCustomUI:', this.showCustomUI);

                // Set selected value if initialSelectedValue is provided
                if (this.initialSelectedValue) {
                    this.selectedOption = this.initialSelectedValue;
                    this.selectedValue = this.initialSelectedValue;

                    // Dispatch Flow Attribute Change Event
                    this.dispatchFlowAttributeChangeEvent('selectedValue', this.selectedValue);
                }
            } else {
                console.warn(`Field "${this._fieldApiName}" not found in picklistFieldValues.`);
            }
        } else if (error) {
            console.error('Error fetching picklist values:', error);
        }
    }

    // Handle selection change in the combobox
    handleSelectionChange(event) {
        this.selectedOption = event.detail.value;
        this.selectedValue = this.selectedOption;

        // Dispatch Flow Attribute Change Event
        this.dispatchFlowAttributeChangeEvent('selectedValue', this.selectedValue);
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

        // If isRequired is true, a value must be selected
        if (this.selectedOption && this.selectedOption.length > 0) {
            return { isValid: true };
        } else {
            return {
                isValid: false,
                errorMessage: 'Please select a value.'
            };
        }
    }

    get hasCustomDefinitions() {
        const hasDefinitions = this._picklistDefinitions && 
               this.parsedDefinitions && 
               Object.keys(this.parsedDefinitions).length > 0 &&
               this.picklistOptionsWithHelp && 
               this.picklistOptionsWithHelp.some(opt => opt.hasHelp);
        
        console.log('SuperComboboxLWC - hasCustomDefinitions:', hasDefinitions, {
            picklistDefinitions: this._picklistDefinitions,
            parsedDefinitions: this.parsedDefinitions,
            hasHelpText: this.picklistOptionsWithHelp?.some(opt => opt.hasHelp)
        });
        
        return hasDefinitions;
    }

    get currentHelpText() {
        if (!this.showCustomUI || !this.selectedOption) return '';
        
        const selectedOpt = this.picklistOptionsWithHelp.find(opt => opt.value === this.selectedOption);
        return selectedOpt?.helpText || '';
    }

    get hasCurrentHelpText() {
        return !!this.currentHelpText;
    }
}