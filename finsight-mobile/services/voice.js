// Speech recognition through expo-speech-recognition, shaped like the older
// @react-native-voice API the screens were written for: set the on* handlers,
// then start() and stop(). That library didn't load under the New Architecture.
import { ExpoSpeechRecognitionModule as Speech } from 'expo-speech-recognition';

let subscriptions = [];

const Voice = {
  onSpeechStart: null,
  onSpeechEnd: null,
  onSpeechError: null,
  onSpeechResults: null,

  async isAvailable() {
    return Speech.isRecognitionAvailable();
  },

  async start(lang = 'en-US') {
    listen();
    const { granted } = await Speech.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission was not given');
    Speech.start({ lang, interimResults: false, maxAlternatives: 1 });
  },

  async stop() {
    Speech.stop();
  },

  // Stops listening without reporting it as an error to a screen that's closing.
  async destroy() {
    unlisten();
    Speech.abort();
  },

  // Handlers are left alone: the next screen may already have set its own.
  removeAllListeners() {
    unlisten();
  },
};

function listen() {
  if (subscriptions.length) return;
  subscriptions = [
    Speech.addListener('start', () => Voice.onSpeechStart?.()),
    Speech.addListener('end', () => Voice.onSpeechEnd?.()),
    Speech.addListener('result', event => {
      if (event.isFinal) Voice.onSpeechResults?.({ value: event.results.map(r => r.transcript) });
    }),
    Speech.addListener('error', event => Voice.onSpeechError?.({ error: event })),
  ];
}

function unlisten() {
  subscriptions.forEach(s => s.remove());
  subscriptions = [];
}

export default Voice;
