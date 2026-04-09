const { getTenantConfigById } = require("../services/tenant-config.service");
const { getUserPermissions } = require("../services/permissions.service");

async function attachRequestContext(req, _res, next) {
  if (!req.user?.studio_id) {
    return next();
  }

  try {
    const studioId = Number(req.user.studio_id);
    const [tenant, permissions] = await Promise.all([
      getTenantConfigById(studioId),
      getUserPermissions(req.user),
    ]);

    req.tenant = tenant;
    req.user.permissions = permissions;

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  attachRequestContext,
};
