const { createRunOncePlugin, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'with-rnfb-fix';
const PLUGIN_VERSION = '1.0.0';
const MARKER = '[with-rnfb-fix]';
const RNFB_TARGETS = ['RNFBApp', 'RNFBAuth'];

function injectPostInstallPatch(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const postInstallStart = contents.indexOf('post_install do |installer|');
  if (postInstallStart === -1) {
    throw new Error(`${PLUGIN_NAME}: Could not find post_install block in Podfile.`);
  }

  const postInstallBody = contents.slice(postInstallStart);
  const endMatch = postInstallBody.match(/^\s*end\s*$/m);
  if (!endMatch || endMatch.index == null) {
    throw new Error(`${PLUGIN_NAME}: Could not find the end of the post_install block in Podfile.`);
  }

  const insertAt = postInstallStart + endMatch.index;
  const snippet = `
  # ${MARKER} Allow RNFirebase pods to import React headers when use_frameworks! is enabled.
  installer.pods_project.targets.each do |target|
    if ${JSON.stringify(RNFB_TARGETS)}.include?(target.name)
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        other_cflags = Array(config.build_settings['OTHER_CFLAGS'] || '$(inherited)')
        other_cflags << '-Wno-non-modular-include-in-framework-module'
        config.build_settings['OTHER_CFLAGS'] = other_cflags.uniq
      end
    end
  end

`;

  return `${contents.slice(0, insertAt)}${snippet}${contents.slice(insertAt)}`;
}

const withRNFBFix = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const original = fs.readFileSync(podfilePath, 'utf8');
      const updated = injectPostInstallPatch(original);

      if (updated !== original) {
        fs.writeFileSync(podfilePath, updated);
      }

      return cfg;
    },
  ]);

module.exports = createRunOncePlugin(withRNFBFix, PLUGIN_NAME, PLUGIN_VERSION);
