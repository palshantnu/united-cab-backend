const { AppVersion } = require('../models');

const APPS = ['user', 'driver'];
const PLATFORMS = ['android', 'ios'];
const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;

// Rows created on first start; admin fills in / edits the rest from the panel
const DEFAULTS = {
  user: {
    android: { latest_version: '1.12', store_url: 'https://play.google.com/store/apps/details?id=com.united_cabs_merthyr' },
    ios: { latest_version: '1.0.13', store_url: null },
  },
  driver: {
    android: { latest_version: '1.11', store_url: 'https://play.google.com/store/apps/details?id=com.united_cab_merthyr_driver' },
    ios: { latest_version: '1.0.12', store_url: null },
  },
};

const DEFAULT_TITLE = 'Update available';
const DEFAULT_MESSAGE = {
  normal: 'A new version of the app is available with improvements and bug fixes. Update now for the best experience.',
  force: 'This version of the app is no longer supported. Please update to continue using the app.',
};

// Numeric segment compare: '1.0.13' vs '1.12' → -1 / 0 / 1
function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

async function ensureDefaults() {
  for (const app of APPS) {
    for (const platform of PLATFORMS) {
      await AppVersion.findOrCreate({
        where: { app, platform },
        defaults: { app, platform, ...DEFAULTS[app][platform] },
      });
    }
  }
}

// Decides what the app on `version` should show
async function checkForUpdate(app, platform, version) {
  const config = await AppVersion.findOne({ where: { app, platform } });
  const result = {
    update_available: false,
    update_type: 'none',
    current_version: version,
    latest_version: config?.latest_version || version,
  };
  if (!config || !config.is_active) return result;

  let updateType = 'none';
  if (config.min_version && compareVersions(version, config.min_version) < 0) {
    updateType = 'force';
  } else if (compareVersions(version, config.latest_version) < 0) {
    updateType = config.update_type;
  }
  if (updateType === 'none') return result;

  return {
    ...result,
    update_available: true,
    update_type: updateType,
    store_url: config.store_url,
    title: config.title || DEFAULT_TITLE,
    message: config.message || DEFAULT_MESSAGE[updateType],
  };
}

module.exports = { APPS, PLATFORMS, VERSION_PATTERN, compareVersions, ensureDefaults, checkForUpdate };
