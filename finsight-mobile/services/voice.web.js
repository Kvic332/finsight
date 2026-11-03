// Speech recognition is phone-only. The web preview uses this stand-in.
export default {
  isAvailable: async () => false,
  start: async () => {},
  stop: async () => {},
  destroy: async () => {},
  removeAllListeners: () => {},
};
