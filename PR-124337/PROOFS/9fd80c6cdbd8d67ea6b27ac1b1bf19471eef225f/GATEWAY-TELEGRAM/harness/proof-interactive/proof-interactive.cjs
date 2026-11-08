// Minimal plugin for the openclaw#124337 Telegram proof: one Telegram interactive handler
// (namespace "proof") that returns { submitText }, the plugin-callback path the PR changed.
const fs = require("node:fs");
module.exports = {
  id: "proof-interactive",
  register(api) {
    api.registerInteractiveHandler({
      channel: "telegram",
      namespace: "proof",
      handler: async (ctx) => {
        const line = { t: new Date().toISOString(), callbackId: ctx.callbackId, data: ctx.callback?.data, messageId: ctx.callback?.messageId, authorized: ctx.auth?.isAuthorizedSender };
        if (process.env.PROOF_HANDLER_LOG) fs.appendFileSync(process.env.PROOF_HANDLER_LOG, JSON.stringify(line) + "\n");
        return { submitText: "MSG-SUBMIT button pressed" };
      },
    });
  },
};
