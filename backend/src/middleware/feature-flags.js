const { getTenantConfigById } = require("../services/tenant-config.service");
const { isFeatureEnabled } = require("../services/feature-flags.service");

function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const studioId = Number(req.user?.studio_id);
      if (!studioId) {
        return res.status(401).json({
          message: "Contesto tenant non disponibile.",
        });
      }

      const tenant = await getTenantConfigById(studioId);
      if (!tenant || !tenant.is_active) {
        return res.status(403).json({
          message: "Tenant non attivo o non configurato.",
        });
      }

      const enabled = await isFeatureEnabled(studioId, featureKey, tenant.vertical_key);
      if (!enabled) {
        return res.status(403).json({
          message: `Funzionalita disattivata per il tenant: ${featureKey}.`,
        });
      }

      req.tenant = tenant;
      return next();
    } catch (error) {
      return res.status(500).json({
        message: "Errore nella verifica feature flag tenant.",
        detail: error.message,
      });
    }
  };
}

module.exports = {
  requireFeature,
};
