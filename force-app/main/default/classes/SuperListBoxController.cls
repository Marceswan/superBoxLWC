public with sharing class SuperListBoxController {
    
    @AuraEnabled(cacheable=true)
    public static List<ObjectOption> getObjectOptions() {
        List<ObjectOption> options = new List<ObjectOption>();
        
        // Get all SObjects in the org
        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        
        for (String objectName : globalDescribe.keySet()) {
            Schema.SObjectType sObjectType = globalDescribe.get(objectName);
            Schema.DescribeSObjectResult describeResult = sObjectType.getDescribe();
            
            // Filter out system objects and objects user doesn't have access to
            if (describeResult.isAccessible() && 
                describeResult.isQueryable() && 
                !describeResult.isDeprecatedAndHidden()) {
                
                ObjectOption option = new ObjectOption();
                option.label = describeResult.getLabel();
                option.value = describeResult.getName();
                options.add(option);
            }
        }
        
        // Sort by label
        options.sort();
        
        return options;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<FieldOption> getPicklistFields(String objectApiName) {
        List<FieldOption> options = new List<FieldOption>();
        
        if (String.isBlank(objectApiName)) {
            return options;
        }
        
        try {
            // Get the SObject type
            Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectApiName);
            if (sObjectType == null) {
                return options;
            }
            
            // Get all fields for the object
            Map<String, Schema.SObjectField> fieldMap = sObjectType.getDescribe().fields.getMap();
            
            for (String fieldName : fieldMap.keySet()) {
                Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
                
                // Only include picklist and multi-select picklist fields that are accessible
                if (fieldDescribe.isAccessible() && 
                    (fieldDescribe.getType() == Schema.DisplayType.PICKLIST || 
                     fieldDescribe.getType() == Schema.DisplayType.MULTIPICKLIST)) {
                    
                    FieldOption option = new FieldOption();
                    option.label = fieldDescribe.getLabel();
                    option.value = fieldDescribe.getName();
                    option.isMultiSelect = (fieldDescribe.getType() == Schema.DisplayType.MULTIPICKLIST);
                    options.add(option);
                }
            }
            
            // Sort by label
            options.sort();
            
        } catch (Exception e) {
            System.debug('Error getting picklist fields: ' + e.getMessage());
        }
        
        return options;
    }
    
    // Inner classes for options
    public class ObjectOption implements Comparable {
        @AuraEnabled public String label;
        @AuraEnabled public String value;
        
        public Integer compareTo(Object compareTo) {
            ObjectOption compareToOption = (ObjectOption) compareTo;
            return label.compareTo(compareToOption.label);
        }
    }
    
    public class FieldOption implements Comparable {
        @AuraEnabled public String label;
        @AuraEnabled public String value;
        @AuraEnabled public Boolean isMultiSelect;
        
        public Integer compareTo(Object compareTo) {
            FieldOption compareToOption = (FieldOption) compareTo;
            return label.compareTo(compareToOption.label);
        }
    }
}