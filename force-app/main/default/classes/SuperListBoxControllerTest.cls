@isTest
private class SuperListBoxControllerTest {
    
    @isTest
    static void testGetObjectOptions() {
        Test.startTest();
        List<SuperListBoxController.ObjectOption> options = SuperListBoxController.getObjectOptions();
        Test.stopTest();
        
        // Verify we get some objects back
        System.assertNotEquals(null, options, 'Options should not be null');
        System.assert(options.size() > 0, 'Should return at least one object');
        
        // Verify standard objects are included
        Set<String> objectNames = new Set<String>();
        for (SuperListBoxController.ObjectOption option : options) {
            objectNames.add(option.value);
        }
        
        System.assert(objectNames.contains('Account'), 'Should include Account object');
        System.assert(objectNames.contains('Contact'), 'Should include Contact object');
        
        // Verify each option has required fields
        for (SuperListBoxController.ObjectOption option : options) {
            System.assertNotEquals(null, option.label, 'Label should not be null');
            System.assertNotEquals(null, option.value, 'Value should not be null');
        }
    }
    
    @isTest
    static void testGetPicklistFields() {
        Test.startTest();
        List<SuperListBoxController.FieldOption> fields = SuperListBoxController.getPicklistFields('Account');
        Test.stopTest();
        
        // Verify we get fields back
        System.assertNotEquals(null, fields, 'Fields should not be null');
        
        // Verify each field has required properties
        for (SuperListBoxController.FieldOption field : fields) {
            System.assertNotEquals(null, field.label, 'Field label should not be null');
            System.assertNotEquals(null, field.value, 'Field value should not be null');
            System.assertNotEquals(null, field.isMultiSelect, 'isMultiSelect should not be null');
        }
        
        // Verify common Account picklist fields are included (if they exist)
        Set<String> fieldNames = new Set<String>();
        for (SuperListBoxController.FieldOption field : fields) {
            fieldNames.add(field.value.toLowerCase());
        }
        
        // Type is a common picklist field on Account
        try {
            Schema.DescribeFieldResult typeFieldDescribe = Account.Type.getDescribe();
            if (typeFieldDescribe.isAccessible() && 
                (typeFieldDescribe.getType() == Schema.DisplayType.PICKLIST || 
                 typeFieldDescribe.getType() == Schema.DisplayType.MULTIPICKLIST)) {
                System.assert(fieldNames.contains('type'), 'Should include Type field if accessible and is a picklist');
            }
        } catch (Exception e) {
            // Field might not exist in this org, which is okay for the test
            System.debug('Type field not accessible or does not exist: ' + e.getMessage());
        }
    }
    
    @isTest
    static void testGetPicklistFieldsWithInvalidObject() {
        Test.startTest();
        List<SuperListBoxController.FieldOption> fields = SuperListBoxController.getPicklistFields('InvalidObject');
        Test.stopTest();
        
        // Should return empty list for invalid object
        System.assertNotEquals(null, fields, 'Fields should not be null');
        System.assertEquals(0, fields.size(), 'Should return empty list for invalid object');
    }
    
    @isTest
    static void testGetPicklistFieldsWithBlankObject() {
        Test.startTest();
        List<SuperListBoxController.FieldOption> fields1 = SuperListBoxController.getPicklistFields('');
        List<SuperListBoxController.FieldOption> fields2 = SuperListBoxController.getPicklistFields(null);
        Test.stopTest();
        
        // Should return empty list for blank/null object
        System.assertEquals(0, fields1.size(), 'Should return empty list for blank object');
        System.assertEquals(0, fields2.size(), 'Should return empty list for null object');
    }
    
    @isTest
    static void testObjectOptionComparable() {
        SuperListBoxController.ObjectOption option1 = new SuperListBoxController.ObjectOption();
        option1.label = 'Account';
        option1.value = 'Account';
        
        SuperListBoxController.ObjectOption option2 = new SuperListBoxController.ObjectOption();
        option2.label = 'Contact';
        option2.value = 'Contact';
        
        List<SuperListBoxController.ObjectOption> options = new List<SuperListBoxController.ObjectOption>{option2, option1};
        options.sort();
        
        System.assertEquals('Account', options[0].label, 'First option should be Account after sorting');
        System.assertEquals('Contact', options[1].label, 'Second option should be Contact after sorting');
    }
    
    @isTest
    static void testFieldOptionComparable() {
        SuperListBoxController.FieldOption field1 = new SuperListBoxController.FieldOption();
        field1.label = 'Type';
        field1.value = 'Type';
        field1.isMultiSelect = false;
        
        SuperListBoxController.FieldOption field2 = new SuperListBoxController.FieldOption();
        field2.label = 'Industry';
        field2.value = 'Industry';
        field2.isMultiSelect = false;
        
        List<SuperListBoxController.FieldOption> fields = new List<SuperListBoxController.FieldOption>{field1, field2};
        fields.sort();
        
        System.assertEquals('Industry', fields[0].label, 'First field should be Industry after sorting');
        System.assertEquals('Type', fields[1].label, 'Second field should be Type after sorting');
    }
}