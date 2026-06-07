/**
 * Custom Expo config plugin: exclude legacy com.android.support from ALL subprojects.
 *
 * @react-native-voice/voice pulls in com.android.support:support-compat:28.0.0 which
 * clashes with androidx.core:core:1.16.0 (duplicate class error).  Jetifier alone
 * does not fix the exclusion; we must also tell Gradle to never resolve the old group.
 *
 * This plugin appends the exclusion rule to android/build.gradle so it applies to
 * every subproject (including voice).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAndroidExclusion = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        'build.gradle'
      );

      let contents = fs.readFileSync(buildGradlePath, 'utf8');

      const marker = '// [finsight] exclude legacy support libs';
      if (!contents.includes(marker)) {
        const exclusionBlock = `
${marker}
subprojects {
    configurations.all {
        exclude group: 'com.android.support'
    }
}
`;
        // Append at end of file
        contents = contents + exclusionBlock;
        fs.writeFileSync(buildGradlePath, contents, 'utf8');
      }

      return config;
    },
  ]);
};

module.exports = withAndroidExclusion;
