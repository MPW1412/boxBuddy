import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert that works consistently on web and native
 */
export const showAlert = (title, message, buttons = []) => {
  if (Platform.OS === 'web') {
    // For web, we need to handle it differently
    if (buttons.length === 0) {
      // Simple alert
      window.alert(message || title);
    } else if (buttons.length === 1) {
      // Alert with OK button
      window.alert(message || title);
      if (buttons[0].onPress) {
        buttons[0].onPress();
      }
    } else {
      // Confirm dialog with multiple buttons
      const result = window.confirm(message || title);
      if (result) {
        // Find the non-cancel button and execute it
        const confirmButton = buttons.find(b => b.style !== 'cancel');
        if (confirmButton && confirmButton.onPress) {
          confirmButton.onPress();
        }
      } else {
        // Find the cancel button and execute it
        const cancelButton = buttons.find(b => b.style === 'cancel');
        if (cancelButton && cancelButton.onPress) {
          cancelButton.onPress();
        }
      }
    }
  } else {
    // Native platform - use regular Alert
    Alert.alert(title, message, buttons);
  }
};
