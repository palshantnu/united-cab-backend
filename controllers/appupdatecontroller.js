const { AppVersion } = require('../models/index');
const { APPS, PLATFORMS, VERSION_PATTERN, compareVersions, checkForUpdate } = require('../services/appVersionService');

class appupdatecontroller {

  // GET /settings/app-updates
  static page = async (req, res) => {
    try {
      const rows = await AppVersion.findAll();
      const configs = {};
      rows.forEach(row => {
        configs[row.app] = configs[row.app] || {};
        configs[row.app][row.platform] = row;
      });
      res.render('admin/app_updates', { configs });
    } catch (error) {
      console.error('app updates page error:', error);
      res.status(500).send('Something went wrong!');
    }
  };

  // POST /settings/app-updates/:id
  static save = async (req, res) => {
    try {
      const config = await AppVersion.findByPk(req.params.id);
      if (!config) {
        req.flash('error', 'Update setting not found.');
        return res.redirect('/settings/app-updates');
      }

      const label = `${config.app === 'user' ? 'User' : 'Driver'} app (${config.platform === 'ios' ? 'iOS' : 'Android'})`;
      const latest = (req.body.latest_version || '').trim();
      const minVersion = (req.body.min_version || '').trim();
      const updateType = req.body.update_type === 'force' ? 'force' : 'normal';
      const storeUrl = (req.body.store_url || '').trim();
      const isActive = req.body.is_active === 'on' || req.body.is_active === '1';

      if (!VERSION_PATTERN.test(latest)) {
        req.flash('error', `${label}: latest version must look like 1.2 or 1.2.3`);
        return res.redirect('/settings/app-updates');
      }
      if (minVersion && !VERSION_PATTERN.test(minVersion)) {
        req.flash('error', `${label}: minimum version must look like 1.2 or 1.2.3`);
        return res.redirect('/settings/app-updates');
      }
      if (minVersion && compareVersions(minVersion, latest) > 0) {
        req.flash('error', `${label}: minimum version cannot be higher than the latest version`);
        return res.redirect('/settings/app-updates');
      }
      if (storeUrl && !/^(https?:\/\/|itms-apps:\/\/|market:\/\/)/i.test(storeUrl)) {
        req.flash('error', `${label}: store link must start with https://`);
        return res.redirect('/settings/app-updates');
      }
      if (isActive && !storeUrl) {
        req.flash('error', `${label}: add the store link before turning updates on`);
        return res.redirect('/settings/app-updates');
      }

      // A force update stays forced for everyone below it, even after a later normal release
      let finalMin = minVersion || null;
      if (updateType === 'force' && (!finalMin || compareVersions(finalMin, latest) < 0)) {
        finalMin = latest;
      }

      await config.update({
        latest_version: latest,
        update_type: updateType,
        min_version: finalMin,
        store_url: storeUrl || null,
        title: (req.body.title || '').trim() || null,
        message: (req.body.message || '').trim() || null,
        is_active: isActive,
        updated_at: new Date(),
      });

      req.flash('success', `${label} update settings saved.`);
      res.redirect('/settings/app-updates');
    } catch (error) {
      console.error('app updates save error:', error);
      req.flash('error', 'Could not save update settings.');
      res.redirect('/settings/app-updates');
    }
  };

  // POST /api/app-version/check { app: 'user' | 'driver', platform: 'android' | 'ios', version: '1.0.13' }
  static api_check = async (req, res) => {
    try {
      const { app, platform } = req.body;
      const version = String(req.body.version || '').trim();
      if (!APPS.includes(app) || !PLATFORMS.includes(platform) || !VERSION_PATTERN.test(version)) {
        return res.status(400).json({
          success: false,
          message: "app ('user' | 'driver'), platform ('android' | 'ios') and version (e.g. 1.0.13) are required",
        });
      }
      res.json({ success: true, ...(await checkForUpdate(app, platform, version)) });
    } catch (error) {
      console.error('app version check error:', error);
      res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  };
}

module.exports = appupdatecontroller;
