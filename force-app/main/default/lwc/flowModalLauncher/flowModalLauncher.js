// flowModalLauncher.js
import { LightningElement, api } from 'lwc';

export default class FlowModalLauncher extends LightningElement {
  @api flowName;
  @api inputVars;
  @api label = 'Add Contact';

  isModalOpen = false;

  get inputVariables() {
    // If inputVars is null (or falsy), return the default configuration
    if (!this.inputVars) {
      return [
        {
          name: 'accId',
          type: 'String',
          value: this.inputVars
        }
      ];
    } else {
      // Otherwise, assume inputVars is a string in the format:
      // "PropertyName::PropertyValue;Property2Name::Property2Value"
      // Split the string on semicolons to get each key-value pair
      return this.inputVars.split(';').map(pair => {
        // Split each pair on "::" to separate the property name from its value
        const [propName, propValue] = pair.split('::');
        return {
          name: propName.trim(),
          type: 'String',
          value: propValue.trim()
        };
      });
    }
  }

  handleClick() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  handleStatusChange(event) {
    if (event.detail.status === 'FINISHED' || event.detail.status === 'FINISHED_SCREEN') {
      this.closeModal();
    }
  }
}