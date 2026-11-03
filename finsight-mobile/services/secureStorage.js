import * as SecureStore from 'expo-secure-store';

// Encrypted by the phone's own keystore. Readable only by this app.
export const getSecure = key => SecureStore.getItemAsync(key);
export const setSecure = (key, value) => SecureStore.setItemAsync(key, value);
export const deleteSecure = key => SecureStore.deleteItemAsync(key);
