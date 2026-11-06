/**
 * Expo config plugin: lets the app find the phone's speech recognition service.
 *
 * Since Android 11, an app only sees other apps' services it declares in
 * <queries>. Without this, voice input reports "not available" on most phones,
 * so ARIA's microphone and "Say it" on Add transaction stay hidden.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const ACTIONS = ['android.speech.RecognitionService', 'android.speech.action.RECOGNIZE_SPEECH'];

function addSpeechQueries(manifest) {
  const root = manifest.manifest;
  root.queries = root.queries || [{}];
  const queries = root.queries[0];
  queries.intent = queries.intent || [];
  const declared = new Set(queries.intent.flatMap(i => (i.action || []).map(a => a.$?.['android:name'])));
  for (const action of ACTIONS) {
    if (!declared.has(action)) queries.intent.push({ action: [{ $: { 'android:name': action } }] });
  }
  return manifest;
}

const withSpeechRecognition = config => withAndroidManifest(config, cfg => {
  cfg.modResults = addSpeechQueries(cfg.modResults);
  return cfg;
});

module.exports = withSpeechRecognition;
module.exports.addSpeechQueries = addSpeechQueries;
