// Browsers have no keystore. The web build is only a design preview on sample
// data, so plain storage is fine here.
export const getSecure = async key => window.localStorage.getItem(key);
export const setSecure = async (key, value) => window.localStorage.setItem(key, value);
export const deleteSecure = async key => window.localStorage.removeItem(key);
