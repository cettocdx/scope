const {
  withDangerousMod,
  withEntitlementsPlist,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * iOS build fixes applied on every `expo prebuild`:
 *
 * 1. fmt (bundled with React Native) fails to compile on newer Xcode with
 *    "call to consteval function … is not a constant expression". Turning off
 *    fmt's consteval path fixes it.
 * 2. expo-notifications adds the push (aps-environment) entitlement, but SCOPE
 *    only schedules local notifications. Dropping it keeps the app buildable
 *    without a push-enabled provisioning profile.
 */
const MARKER = "# scope: fmt consteval fix";

function withFmtFix(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let src = fs.readFileSync(podfile, "utf8");
      if (!src.includes(MARKER)) {
        src = src.replace(
          /post_install do \|installer\|\n/,
          `post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        defs = bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        defs << 'FMT_USE_CONSTEVAL=0' unless defs.include?('FMT_USE_CONSTEVAL=0')
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
      end
    end
`,
        );
        fs.writeFileSync(podfile, src);
      }
      return cfg;
    },
  ]);
}

function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    return cfg;
  });
}

module.exports = function withIosBuildFixes(config) {
  return withoutPushEntitlement(withFmtFix(config));
};
