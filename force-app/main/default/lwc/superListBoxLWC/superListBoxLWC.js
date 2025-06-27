import { LightningElement, api, track, wire } from 'lwc';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';

export default class SuperListBoxLWC extends LightningElement {
    @api recordTypeId; // Optional Input: Record Type ID
    @api isRequired = false;

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

    @api initialSelectedValues; // New Input: Pre-selected values
    @api selectedAsString; // Output: Selected values as string    @api selectedAsCollection; // Output: Selected values as collection
    @api cardTitle = 'Select Values';

    @track picklistOptions = []; // Options for dual listbox
    @track selectedValues = []; // Holds the selected values

    effectiveRecordTypeId = null;
    picklistParams = null;

    // Fetch object info to get default record type if recordTypeId is not provided
    @wire(getObjectInfo, { objectApiName: '$_objectApiName' })
    objectInfo({ error, data }) {
        if (data) {
            console.log('Object Info Data:', data);
            this.effectiveRecordTypeId = this.recordTypeId || data.defaultRecordTypeId;
            console.log('Using Record Type ID:', this.effectiveRecordTypeId);
            this.updatePicklistParams();
        } else if (error) {
            console.error('Error fetching object info:', error);
        }
    }

    updatePicklistParams() {
        if (this.effectiveRecordTypeId && this._objectApiName && this._fieldApiName) {
            this.picklistParams = {
                objectApiName: this._objectApiName,
                recordTypeId: this.effectiveRecordTypeId
            };
        }
    }
    // Fetch picklist values for the given object and record type
    @wire(getPicklistValuesByRecordType, { objectApiName: '$picklistParams.objectApiName', recordTypeId: '$picklistParams.recordTypeId' })
    wiredPicklistValues({ error, data }) {
        if (data) {
            if (this._fieldApiName && data.picklistFieldValues[this._fieldApiName]) {
                const fieldData = data.picklistFieldValues[this._fieldApiName];
                this.picklistOptions = fieldData.values.map((item) => {
                    return { label: item.label, value: item.value };
                });

                // Set selected values if initialSelectedValues are provided
                if (this.initialSelectedValues && this.initialSelectedValues.length > 0) {
                    this.selectedValues = [...this.initialSelectedValues];
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

    // Handle selection change in the dual listbox    handleSelectionChange(event) {
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
}