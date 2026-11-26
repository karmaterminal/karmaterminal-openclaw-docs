// Probe-only. A source checkout's plugin loader requires two ESM-only packages that a built gateway imports; when a
// require can't resolve one, resolve it again with the "import" condition. Nothing else is changed.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
      return nextResolve(specifier, { ...context, conditions: [...(context.conditions || []), "import"] });
    }
  },
});
