import {LightningElement, wire, api, track} from 'lwc';
import {getObjectInfo} from 'lightning/uiObjectInfoApi';
import {ShowToastEvent} from 'lightning/platformShowToastEvent';
import {
    formattedValue,
    isReference,
    getDataType,
    removeFormatting,
    flowComboboxDefaults
} from 'c/stringArrayUtils';
import Placeholder_Text from '@salesforce/label/c.fsc_Manual_Reference_Allowed';
import getObjectFields from '@salesforce/apex/usf3.FieldSelectorController.getObjectFields';

const OUTPUTS_FROM_LABEL = 'Outputs from '; 
export default class StringArrayCombobox extends LightningElement {
    @api name;
    @api label;
    @api required = false;
    @api builderContextFilterType;
    _builderContextFilterCollectionBoolean;
    @api 
    get builderContextFilterCollectionBoolean() {
        return this._builderContextFilterCollectionBoolean;
    }
    set builderContextFilterCollectionBoolean(value) {
        // Convert string to boolean if needed
        if (typeof value === 'string') {
            this._builderContextFilterCollectionBoolean = value.toLowerCase() === 'true';
        } else {
            this._builderContextFilterCollectionBoolean = !!value;
        }
        console.log('stringArrayCombobox - builderContextFilterCollectionBoolean set to:', this._builderContextFilterCollectionBoolean);
        // Re-process options when filter changes
        if (this.allOptions && this.allOptions.length) {
            this.processOptions();
        }
    }
    @api maxWidth;
    @api autocomplete = 'off';
    @api fieldLevelHelp;
    @api disabled;

    @api 
    get allowHardCodeReference() {
        return this._allowHardCodeReference;
    } 
    set allowHardCodeReference(value) {
        this._allowHardCodeReference = value;
        this.placeholderText = value ? Placeholder_Text : '';
    }
    _allowHardCodeReference = false;
    placeholderText;

    @track _dataType;
    @track _value;
    @track allOptions;
    @track _options = [];
    @track _mergeFields = [];
    @track dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
    @track isDataSelected = false;
    @track _selectedObjectType;
    @track _selectedFieldPath;
    @track _RecordObject;
    @track hasError = false;
    isMenuOpen = false;
    isDataModified = false;
    selfEvent = false;
    key = 0;
    _builderContext;
    _automaticOutputVariables;
    labels = {
        noDataAvailable: 'No matching mergefields or variables are available ',
        staticOptionsLabel: 'OBJECT FIELDS',
        invalidReferenceError: 'This Flow doesn\'t have a defined resource with that name. If you\'re trying to enter a literal value, don\'t use {!}',
    };
    iconsPerType = {
        String: 'utility:text',
        string: 'utility:text',
        Boolean: 'utility:check',
        Date: 'utility:date_input',
        DateTime: 'utility:date_time',
        Number: 'utility:number_input',
        Int: 'utility:number_input',
        Double: 'utility:number_input',
        Picklist: 'utility:picklist',
        TextArea: 'utility:textarea',
        Phone: 'utility:phone_portrait',
        Address: 'utility:location',
        Currency: 'utility:currency_input',
        Url: 'utility:link',
        SObject: 'utility:sobject',
        reference: 'utility:merge_field',
        actionCalls : 'utility:fallback',
        screenComponent : 'utility:fallback',
        Apex : 'utility:apex',
    };

    typeDescriptors = [
        {
            apiName: 'variables',
            label: 'Variables',
            dataType: 'valueDataType',
            objectTypeField: 'objectType',
            isCollectionField: 'getFirstRecordOnly'
        },
        {apiName: 'constants', label: 'Global Constants', dataType: flowComboboxDefaults.stringDataType},
        {apiName: 'textTemplates', label: 'Variables', dataType: flowComboboxDefaults.stringDataType},
        {apiName: 'stages', label: 'Variables', dataType: flowComboboxDefaults.stringDataType},
        {apiName: 'screens.fields', label: 'Screen Components', dataType: flowComboboxDefaults.screenComponentType},
        {apiName: 'screens.fields.fields.fields', label: 'Screen Components', dataType: flowComboboxDefaults.screenComponentType},
        {
            apiName: flowComboboxDefaults.recordLookupsType,
            label: 'Variables',
            dataType: flowComboboxDefaults.dataTypeSObject,
            objectTypeField: 'object'
        },
        {
            apiName: flowComboboxDefaults.recordCreatesType,
            label: 'Variables',
            dataType: flowComboboxDefaults.dataTypeSObject,
            objectTypeField: 'object'
        },
        {
            apiName: flowComboboxDefaults.recordUpdatesType,
            label: 'Variables',
            dataType: flowComboboxDefaults.dataTypeSObject,
            objectTypeField: 'object'
        },
        {
            apiName: flowComboboxDefaults.actionType,
            label: 'Action Outputs',
            dataType: 'valueDataType',
            objectTypeField: 'objectType',
            isCollectionField: 'getFirstRecordOnly'
        },
        {
            apiName: 'screens.fields',
            label: 'Screen Actions',
            dataType: flowComboboxDefaults.screenActionType,
        },
        {
            apiName: 'globalVariables',
            label: 'Global Variables',
            dataType: flowComboboxDefaults.stringDataType,
        }
    ];

    @api get valueDataType() {
        return this._dataType || flowComboboxDefaults.stringDataType;
    }

    set valueDataType(value) {
        this._dataType = value;
    }

    @api get value() {
        return this._value;
    }

    set value(value) {
        this.isDataModified = false;
        this.selfEvent = true;
        this.setInternalValue(value);
        this.determineSelectedType();
    }

    setInternalValue(value) {
        this._value = value;
        this.processOptions();
    }

    @api
    get displayValue() {
        return this._displayValue;
    }

    set displayValue(value) {
        this._displayValue = value;
    }

    @api get builderContext() {
        return this._builderContext;
    }

    set builderContext(value) {
        console.log('stringArrayCombobox builderContext setter:', value);
        console.log('builderContext.variables:', value?.variables);
        console.log('builderContext.variables length:', value?.variables?.length);
        this._builderContext = value;
        if (this._automaticOutputVariables) {
            this.initFromBuilderContextAndAutomaticOutputVariables();
        }
    }

    @api get automaticOutputVariables () {
        return this._automaticOutputVariables;
    }

    initFromBuilderContextAndAutomaticOutputVariables () {
        this._mergeFields = this.generateMergeFieldsFromBuilderContext(this._builderContext);
        this._mergeFields = this.adjustOptions(this._mergeFields);
        if (!this._selectedObjectType) {
            this.setOptions(this._mergeFields);
            this.determineSelectedType();
        }
    }

    set automaticOutputVariables(value) {
        this._automaticOutputVariables = value;
        if (this._builderContext) {
            this.initFromBuilderContextAndAutomaticOutputVariables();
        }
    }

    get displayPill() {
        return this.isDataSelected && this._dataType === flowComboboxDefaults.referenceDataType;
    }

    setOptions(value) {
        this._options = value;
        this.allOptions = JSON.parse(JSON.stringify(this._options));
        this.processOptions();
    }

    adjustOptions(mergeFields) {
        let sObjectSingleList = [];
        let sObjectCollectionList = []
        mergeFields.forEach(
            optionList => {
                    for(let i = 0; i < optionList.options.length; i++) {
                        if(optionList.options[i].isObject) {
                            if(optionList.options[i].isCollection) {
                                sObjectCollectionList.push(optionList.options[i]);
                            } else {
                                sObjectSingleList.push(optionList.options[i]);
                            }
                            optionList.options.splice(i, 1);
                            i--;
                        }
                    }
                
            }
        );

        mergeFields.push(
            {
                type : 'RECORD (COLLECTION) VARIABLES ',
                options : sObjectCollectionList
            }
        );

        mergeFields.push(
            {
                type : 'RECORD (SINGLE) VARIABLES ',
                options : sObjectSingleList
            }
        );

        return mergeFields;
    }
    getTypeOption(value) {
        if (value) {
            let parentVar = value.split('.')[0];
            if (parentVar && this._mergeFields && this._mergeFields.length) {
                for (let i = 0; i < this._mergeFields.length; i++) {
                    let localOption = this._mergeFields[i].options.find(curTypeOption => {
                        let result = (curTypeOption.value.toLowerCase() === parentVar.toLowerCase()) || (curTypeOption.value.toLowerCase() === value.toLowerCase());
                        return result;
                    });
                    if (localOption) {
                        return localOption;
                    }
                }
            }
        }
    }

    @wire(getObjectInfo, {objectApiName: '$_selectedObjectType'})
    _getObjectInfo({error, data}) {
        if (error) {
            this.showToast('Error', error.body, 'error');
            console.log(error.body);
            this.setOptions([]);
        } else if (data) {
            let tempOptions = [];
            Object.keys(data.fields).forEach(curField => {
                let curFieldData = data.fields[curField];
                let curDataType = curFieldData.dataType === 'Reference' ? 'SObject' : curFieldData.dataType;
                let curObjectType = curFieldData.referenceToInfos.length ? curFieldData.referenceToInfos[0].apiName : null;
                tempOptions.push(this.generateOptionLine(
                    curDataType,
                    curFieldData.label,
                    curFieldData.apiName,
                    false,
                    curObjectType,
                    this.getIconNameByType(curDataType),
                    curDataType === 'SObject',
                    curDataType === 'SObject' ? curObjectType : curDataType,
                    flowComboboxDefaults.defaultKeyPrefix + this.key++
                ));
            });
            this.setOptions([{type: data.label + ' Fields', options: tempOptions}]);
        }

    }

    getTypes() {
        return this.typeDescriptors.map(curTypeDescriptor => curTypeDescriptor.apiName);
    }

    getTypeDescriptor(typeApiName) {
        return this.typeDescriptors.find(curTypeDescriptor => curTypeDescriptor.apiName === typeApiName);
    }

    determineSelectedType() {
        if (this._value && this.allOptions) {
            let valParts = this._value.replace(/[^a-zA-Z0-9._-]/g, '').split('.');
            if (valParts.length > 1) {
                this.allOptions.forEach(curOption => {
                    let localOptions = curOption.options;
                    let selectedOption = localOptions.find(curSelectedOption => curSelectedOption.value === valParts[0]);
                    if (selectedOption && selectedOption.isObject) {
                        this._selectedObjectType = selectedOption.displayType;
                        valParts.pop();
                        this._selectedFieldPath = valParts.join('.');
                    }
                });
            }
        }
    }

    generateMergeFieldsFromBuilderContext(builderContext) {
        console.log('stringArrayCombobox - generateMergeFieldsFromBuilderContext called');
        console.log('stringArrayCombobox - builderContext:', builderContext);
        let optionsByType = {};
        let key = 0;

        this.getTypes().forEach(curType => {
            console.log('stringArrayCombobox - processing type:', curType);
            let typeParts = curType.split('.');
            let typeOptions = [];

            if (builderContext?.start) {
                this._RecordObject = builderContext.start.object;
            }


            if (typeParts.length && builderContext[typeParts[0]]) {
                console.log('stringArrayCombobox - found data for type:', typeParts[0]);
                let objectToExamine = builderContext;
                let parentNodeLabel = '';
                typeParts.forEach(curTypePart => {

                    if (objectToExamine[curTypePart]) {
                        objectToExamine = objectToExamine[curTypePart].map(curItem => {
                            parentNodeLabel = curItem.label ? curItem.label : curItem.name;
                            return {
                                ...curItem,
                                varApiName: curItem.name,
                                varLabel: parentNodeLabel
                            }
                        });
                    } else {
                        if (Array.isArray(objectToExamine)) {
                            let allObjectToExamine = [];
                            objectToExamine.forEach(curObjToExam => {
                                    if (curObjToExam.storeOutputAutomatically) {
                                        
                                    } else if (curObjToExam[curTypePart]) {
                                        allObjectToExamine = [...allObjectToExamine, ...curObjToExam[curTypePart].map(curItem => {
                                            return {
                                                ...curItem, varApiName: curObjToExam.name + '.' + curItem.name,
                                                varLabel: (curObjToExam.label ? curObjToExam.label : parentNodeLabel) + ': ' + curItem.name
                                            }
                                        })];
                                    }
                            });
                            objectToExamine = allObjectToExamine;
                        }
                    }
                });
                let localType = this.getTypeDescriptor(curType);

                let curTypeOptions = this.getOptionLines(
                    objectToExamine,
                    'varLabel',
                    'varApiName',
                    'dataType',
                    localType.isCollectionField ? localType.isCollectionField : flowComboboxDefaults.isCollectionField,
                    localType.objectTypeField ? localType.objectTypeField : 'objectType',
                    localType
                );
                console.log('stringArrayCombobox - curTypeOptions for', curType, ':', curTypeOptions);
                if (curTypeOptions.length) {
                    typeOptions = [...typeOptions, ...curTypeOptions];
                }
                if (typeOptions.length) {
                    if (optionsByType[localType.label]) {
                        optionsByType[localType.label] = [...optionsByType[localType.label], ...typeOptions];
                    } else {
                        optionsByType[localType.label] = typeOptions;
                    }
                }
            } else {
                console.log(curType + ' is undefined');
            }
        });

        // Add Global Variables
        let globalVariables = {
            "globalVariables":[
            {
                type: 'String',
                label: '$Flow',
                value: '$Flow',      
                isCollection: false,
                objectType: 'objectType',
                optionIcon: "utility:system_and_global_variable",
                isObject: false,
                globalVariable: true,
                displayType: "String",
                key: flowComboboxDefaults.defaultGlobalVariableKeyPrefix + key++,
                flowType: "reference",
                storeOutputAutomatically: false
            },
            {
                type: 'String',
                label: '$User',
                value: '$User',      
                isCollection: false,
                objectType: 'objectType',
                optionIcon: "utility:system_and_global_variable",
                isObject: false,
                globalVariable: true,
                displayType: "String",
                key: flowComboboxDefaults.defaultGlobalVariableKeyPrefix + key++,
                flowType: "reference",
                storeOutputAutomatically: false
            },
            {
                type: 'String',
                label: '$UserRole',
                value: '$UserRole',      
                isCollection: false,
                objectType: 'objectType',
                optionIcon: "utility:system_and_global_variable",
                isObject: false,
                globalVariable: true,
                displayType: "String",
                key: flowComboboxDefaults.defaultGlobalVariableKeyPrefix + key++,
                flowType: "reference",
                storeOutputAutomatically: false
            },
            {
                type: 'String',
                label: '$Profile',
                value: '$Profile',      
                isCollection: false,
                objectType: 'objectType',
                optionIcon: "utility:system_and_global_variable",
                isObject: false,
                globalVariable: true,
                displayType: "String",
                key: flowComboboxDefaults.defaultGlobalVariableKeyPrefix + key++,
                flowType: "reference",
                storeOutputAutomatically: false
            },
            {
                type: 'String',
                label: '$System',
                value: '$System',  
                isCollection: false,
                objectType: 'objectType',
                optionIcon: "utility:system_and_global_variable",
                isObject: false,
                globalVariable: true,
                displayType: "String",
                key: flowComboboxDefaults.defaultGlobalVariableKeyPrefix + key++,
                flowType: "reference",
                storeOutputAutomatically: false
            }
        ]};

        if (this._RecordObject) {
            globalVariables.globalVariables.push(
                {
                    type: 'String',
                    label: '$Record',
                    value: '$Record',
                    isCollection: false,
                    objectType: 'objectType',
                    optionIcon: "utility:system_and_global_variable",
                    isObject: false,
                    globalVariable: true,
                    displayType: "String",
                    key: flowComboboxDefaults.defaultGlobalVariableKeyPrefix + key++,
                    flowType: "reference",
                    storeOutputAutomatically: false
                },                
                {
                    type: 'String',
                    label: '$Record__Prior',
                    value: '$Record__Prior',
                    isCollection: false,
                    objectType: 'objectType',
                    optionIcon: "utility:system_and_global_variable",
                    isObject: false,
                    globalVariable: true,
                    displayType: "String",
                    key: flowComboboxDefaults.defaultGlobalVariableKeyPrefix + key++,
                    flowType: "reference",
                    storeOutputAutomatically: false
                }
            );
        }

        let globalVariablesType = this.getTypeDescriptor('globalVariables').label;
        if (optionsByType[globalVariablesType]) {
            optionsByType[globalVariablesType] = [...optionsByType[globalVariablesType], ...globalVariables.globalVariables];
        } else {
            optionsByType[globalVariablesType] = globalVariables.globalVariables;
        }

        let options = [];
        let allOutputTypes = Object.keys(optionsByType);

        if (allOutputTypes.length) {
            allOutputTypes.forEach(curKey => {
                options.push({type: curKey, options: optionsByType[curKey]});
            });
        }
        return options;
    }

    getOptionLines(objectArray, labelField, valueField, typeField, isCollectionField, objectTypeField, typeDescriptor) {
        let typeOptions = [];
        if (Array.isArray(objectArray)) {
            objectArray.forEach(curObject => {
                let isActionCall = (typeDescriptor.apiName === flowComboboxDefaults.actionType);
                let isScreenAction = typeDescriptor.dataType === flowComboboxDefaults.screenActionType;
                let isScreenComponent = (typeDescriptor.dataType === flowComboboxDefaults.screenComponentType) && curObject.storeOutputAutomatically;
                let isSection = (curObject['name']?.startsWith(flowComboboxDefaults.regionContainerName));
                let curDataType = isScreenAction ? flowComboboxDefaults.screenActionType : (isActionCall) ? flowComboboxDefaults.actionType :  isScreenComponent ? flowComboboxDefaults.screenComponentType : this.getTypeByDescriptor(curObject[typeField], typeDescriptor);
                let label = isActionCall||isScreenAction ?  OUTPUTS_FROM_LABEL + curObject['name'] : curObject[labelField] ? curObject[labelField] : curObject[valueField];
                let curIsCollection = this.isCollection(curObject, isCollectionField);
                const storeOutputAutomatically = (curObject.storeOutputAutomatically && typeDescriptor.dataType !== 'SObject') || typeDescriptor.dataType === flowComboboxDefaults.screenActionType;
                if (!isSection && (!isScreenAction || (this.automaticOutputVariables && this.automaticOutputVariables[curObject.name]))) {
                    typeOptions.push(this.generateOptionLine(
                        curDataType,
                        label,
                        typeDescriptor.dataType === flowComboboxDefaults.screenComponentType ? curObject[valueField].split('.')[1] : curObject[valueField],
                        typeDescriptor.apiName === flowComboboxDefaults.recordLookupsType ? !curIsCollection : !!curIsCollection,
                        curObject[objectTypeField],
                        this.getIconNameByType(curDataType),
                        (curDataType === flowComboboxDefaults.dataTypeSObject || typeDescriptor.apiName === flowComboboxDefaults.recordLookupsType),
                        curDataType === flowComboboxDefaults.dataTypeSObject ? curObject[objectTypeField] : curDataType,
                        flowComboboxDefaults.defaultKeyPrefix + this.key++,
                        null,
                        storeOutputAutomatically
                    ));
                }
            });
        }
        return typeOptions;
    }

    isCollection(curObject, isCollectionField) {
        // Handle inverted logic for variables that use 'getFirstRecordOnly'
        if (isCollectionField === 'getFirstRecordOnly' && curObject.hasOwnProperty('getFirstRecordOnly')) {
            // getFirstRecordOnly = true means it's NOT a collection
            return !curObject.getFirstRecordOnly;
        } else if (curObject.hasOwnProperty(isCollectionField)) {
            return curObject[isCollectionField];
        } else if (curObject.hasOwnProperty('isCollection')) {
            return curObject.isCollection;
        } else {
            return curObject[flowComboboxDefaults.isCollectionField];
        }
    }

    getTypeByDescriptor(curObjectFieldType, typeDescriptor) {
        if (!typeDescriptor) {
            return curObjectFieldType;
        }
        if (typeDescriptor.dataType === flowComboboxDefaults.dataTypeSObject || typeDescriptor.dataType === flowComboboxDefaults.screenComponentType || typeDescriptor.dataType === flowComboboxDefaults.screenActionType) {
            return typeDescriptor.dataType;
        }
        return curObjectFieldType;
    }


    generateOptionLine(type, label, value, isCollection, objectType, optionIcon, isObject, displayType, key, globalVar, storeOutputAutomatically) {
        return {
            type: type,
            label: label,
            value: value,
            isCollection: isCollection,
            objectType: objectType,
            optionIcon: optionIcon,
            isObject: isObject,
            globalVariable : !!globalVar,
            displayType: displayType,
            key: key,
            flowType: flowComboboxDefaults.referenceDataType,
            storeOutputAutomatically: !!storeOutputAutomatically,
        };
    }

    getIconNameByType(variableType) {
        return this.iconsPerType[variableType];
    }

    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(evt);
    }

    handleOpenObject(event) {
        event.stopPropagation();
        this.isDataSelected = false;
        this._dataType = flowComboboxDefaults.referenceDataType;
        this._value = event.currentTarget.dataset.option;
        this._selectedObjectType = event.currentTarget.dataset.objecttype;
        this._selectedFieldPath = event.currentTarget.dataset.value;
        
    }

    handleSetSelectedRecord(event) {
        if (event.currentTarget.dataset) {
            this._value = event.currentTarget.dataset.value;
            this._dataType = flowComboboxDefaults.referenceDataType;
            this.isDataSelected = true;
            this.hasError = false;
            this.isMenuOpen = false;
            this.isDataModified = true;
            this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
            
            // Set display value immediately to ensure it's available
            this._displayValue = this._value;
        }
        event.stopPropagation();
        this.handleDynamicTypeMapping();
        this.dispatchDataChangedEvent();
        
    }

    handleOpenOptions(event) {
        if (this.isMenuOpen) {
            this.isMenuOpen = false;
            this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
        } else {
            this.isMenuOpen = true;
            this.dropdownClass =
                'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open';
        }
        event.stopPropagation();
    }

    handleDynamicTypeMapping() {
        if (this._value && !this.isError) {
            if (isReference(this._value)) {
                this._displayValue = this._value;
                this.setInternalValue(removeFormatting(this._displayValue));
            } else {
                this._displayValue = formattedValue(this._value, this._dataType);
            }
        }
    }

    dispatchDataChangedEvent() {
        // For Flow Builder compatibility, just send the value directly
        const valueToSend = this._displayValue || this._value || '';
        console.log('stringArrayCombobox - dispatching valuechanged:', valueToSend);
        
        // Ensure we're not sending undefined or null
        if (valueToSend !== undefined && valueToSend !== null) {
            const memberRefreshEvt = new CustomEvent('valuechanged', {
                detail: valueToSend,
                bubbles: true,
                composed: true
            });
            this.dispatchEvent(memberRefreshEvt);
        }
    }

    handleWindowClick(event) {
        if (!event.path.includes(this.template.host) && !this.selfEvent) {
            this.isMenuOpen = false;
            this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
        }
        if (this.selfEvent) {
            this.selfEvent = false;
        }
    }

    connectedCallback() {
        document.addEventListener('click', this.handleWindowClick.bind(this));
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.handleWindowClick.bind(this));
    }

    handleDataChange(event) {
        this._value = event.target.value.trim();
        this.isDataSelected = false;
        this.hasError = false;
        this.isDataModified = true;
        this.resetTypeOptions();
        
        this.processOptions();
    }

    resetTypeOptions() {
        this._selectedObjectType = null;
        this._selectedFieldPath = null;
        this.setOptions(this._mergeFields);
    }

    processOptions() {
        console.log('stringArrayCombobox - processOptions called');
        console.log('stringArrayCombobox - allOptions:', this.allOptions);
        console.log('stringArrayCombobox - builderContextFilterCollectionBoolean:', this.builderContextFilterCollectionBoolean);
        
        if (this.allOptions && this.allOptions.length) {
            this._options = JSON.parse(JSON.stringify(this.allOptions));
            
            // Apply filtering
            this._options = this._options.map(curOption => {
                let localOptions = [...curOption.options];
                console.log('stringArrayCombobox - options before filtering:', localOptions.length);
                
                // Filter by type if specified
                if (this.builderContextFilterType) {
                    localOptions = localOptions.filter(opToFilter => 
                        opToFilter.displayType?.toLowerCase() === this.builderContextFilterType.toLowerCase() || 
                        opToFilter.storeOutputAutomatically === true || 
                        (opToFilter.type.toLowerCase() === 'sobject' && !this.builderContextFilterCollectionBoolean)
                    );
                }
                
                // Filter by collection boolean if specified
                if (typeof this.builderContextFilterCollectionBoolean !== "undefined") {
                    const beforeCount = localOptions.length;
                    localOptions = localOptions.filter(opToFilter => 
                        (opToFilter.isCollection === this.builderContextFilterCollectionBoolean) || 
                        (opToFilter.storeOutputAutomatically === true)
                    );
                    console.log('stringArrayCombobox - filtered by collection:', beforeCount, '->', localOptions.length);
                }
                
                // Apply search filter if searching
                if (this._value && this._value.length > 0) {
                    const searchValueLower = this._value.toLowerCase();
                    localOptions = localOptions.filter(optn => 
                        optn.label.toLowerCase().includes(searchValueLower) ||
                        optn.value.toLowerCase().includes(searchValueLower) ||
                        (optn.globalVariable && optn.label.toLowerCase().startsWith(searchValueLower))
                    );
                }
                
                // Apply object type filter if selected
                if (this._selectedObjectType) {
                    localOptions = localOptions.filter(cur => cur.displayType === this._selectedObjectType);
                }
                
                return {
                    ...curOption,
                    options: localOptions
                };
            }).filter(curOption => curOption.options.length > 0);
        } else {
            this._options = [];
        }
    }

    get inputIcon() {
        if (this.hasError) {
            return 'utility:error';
        } else if (this.isDataSelected) {
            switch (this._dataType) {
                case 'String':
                    return 'utility:text';
                case 'Number':
                    return 'utility:number_input';
                case 'Date':
                    return 'utility:date_input';
                case 'DateTime':
                    return 'utility:date_time';
                case 'Boolean':
                    return 'utility:check';
                default:
                    return 'utility:text';
            }

        }
        return '';
    }

    get isDataSelected() {
        return this._value && isReference(this._value);
    }

    get inputValue() {
        if (this.isDataSelected) {
            let typeOption = this.getTypeOption(this._value);
            if (typeOption) {
                return typeOption.label;
            } else {
                this.hasError = true;
                return this._value;
            }
        }
        return this._value;
    }

    get isDisabled() {
        return this.disabled;
    }

    get labelClass() {
        return this.required
            ? 'slds-form-element__label slds-form-element__label-has-required'
            : 'slds-form-element__label';
    }

    get comboboxOuterClass() {
        let resultClass = 'slds-combobox_container';
        if (this.hasError) {
            resultClass += ' slds-has-error';
        }
        if (this._selectedFieldPath) {
            resultClass += ' slds-has-selection';
        }
        return resultClass;
    }

    @api
    reportValidity() {
        return !this.hasError;
    }

    handleOpenScreenComponent(event) {
        event.stopPropagation();
        this.isDataSelected = false;
        this._dataType = flowComboboxDefaults.referenceDataType;
        this._value = event.currentTarget.dataset.option;
        this._selectedObjectType = event.currentTarget.dataset.objecttype;
        this._selectedFieldPath = event.currentTarget.dataset.value;
        
    }

    handleOpenGlobalVariable(event) {
        event.stopPropagation();
        this.isDataSelected = false;
        this._dataType = flowComboboxDefaults.referenceDataType;
        this._value = event.currentTarget.dataset.optionValue;
        this._selectedObjectType = null;
        this._selectedFieldPath = null;
        let curSelectedObject = this.getAnyTypeOption(event.currentTarget.dataset.optionValue);
        if (curSelectedObject) {
            this._selectedObjectType = curSelectedObject.displayType;
            const objClass = curSelectedObject.objectType;
            if(objClass) {
                getObjectFields({ objAPIName: objClass })
                    .then(result => {
                        if(result) {
                            let fieldOptions = [];
                            for(let key in result) {
                                fieldOptions.push(this.generateOptionLine(result[key].DataType,result[key].FieldLabel,result[key].FieldAPIName,false,null,this.getIconNameByType(result[key].DataType),false,result[key].DataType,flowComboboxDefaults.defaultKeyPrefix+this.key++,null,false));
                            }
                            if(fieldOptions.length)
                                this._options = [{type: 'FIELDS', options: fieldOptions}];
                        }
                    });
            }
        }
    }

    getAnyTypeOption(value) {
        let selectedOption = null;
        if (value) {
            this.allOptions.forEach(curOption => {
                let localOptions = curOption.options;
                let localSelectedOption = localOptions.find(curSelectedOption => curSelectedOption.value === value);
                if (localSelectedOption) {
                    selectedOption = localSelectedOption;
                }
            });
        }
        return selectedOption;
    }

    resetData(event) {
        if (event) {
            event.stopPropagation();
        }
        this.resetDataValues();
        
    }

    resetDataValues() {
        this._value = '';
        this.isDataSelected = false;
        this.hasError = false;
        this.isMenuOpen = false;
        this.resetTypeOptions();
        this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
        this.handleDynamicTypeMapping();
        this.dispatchDataChangedEvent();
    }

    handleSearchField(event) {
        this._value = event.currentTarget.value.trim();
        this.isDataSelected = false;
        this.hasError = false;
        this.isDataModified = true;
        this.resetTypeOptions();
        this.processOptions();
    }

    handleSearchKeyUp(event) {
        if(event.keyCode === 27 || event.keyCode === 9) {
            this.toggleMenu(event);
        }
    }

    toggleMenu(event) {
        this.isMenuOpen = !this.isMenuOpen;
        if (this.isMenuOpen) {
            this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open';
        } else {
            this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
        }
    }

    handleKeyDown(event) {
        if (event.keyCode === 40) {  //If key Down pressed
            event.preventDefault();
            if (this._options.length > 0) {
                let firstOption = this.template.querySelector('.slds-listbox__option_entity');
                if (firstOption) {
                    firstOption.focus();
                    this.isMenuOpen = true;
                    this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open';
                }
            }
        } else if (event.keyCode === 13) {  //If key Enter pressed
            if (this.isMenuOpen || (this._value && this._options.length === 1 && this._options[0].options.length === 1)) {
                event.preventDefault();
                this.handleSetSelectedRecord({
                    currentTarget: {
                        dataset: {
                            value: this._options[0].options[0].value,
                            flowType: this._options[0].options[0].flowType,
                            objectType: this._options[0].options[0].objectType
                        }
                    },
                    stopPropagation: () => {}
                });
            }
        }
    }

    get inputStyle() {
        if (this.maxWidth) {
            return 'max-width: ' + this.maxWidth + 'px';
        }
        return '';
    }

    get formElementClass() {
        let resultClass = 'slds-form-element';
        if (this.hasError) {
            resultClass += ' slds-has-error';
        }
        return resultClass;
    }

    handleInputFocus(event) {
        if (!event.relatedTarget || !event.relatedTarget.classList || !event.relatedTarget.classList.contains('value-input')) {
            if (this.isMenuOpen) {
                this.isMenuOpen = false;
                this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
            }
        }
    }
}