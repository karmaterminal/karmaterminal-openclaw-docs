      const targetSessionKeys = readStrictStringArrayParam(params, "targetSessionKeys");
      const fanoutModeRaw = readStringParam(params, "fanoutMode");
      const fanoutMode = fanoutModeRaw?.toLowerCase();
      if (fanoutMode && !FANOUT_MODES.includes(fanoutMode as (typeof FANOUT_MODES)[number])) {
        throw new ToolInputError(
          `Unknown fanoutMode "${fanoutMode}". Valid fanout modes: ${FANOUT_MODES.join(", ")}`,
        );
      }
      if (fanoutMode && (targetSessionKey || (targetSessionKeys && targetSessionKeys.length > 0))) {
        throw new ToolInputError(
          "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys. " +
            "For a targeted return, use targetSessionKey or targetSessionKeys and omit fanoutMode. " +
            "For tree/all fanout, use fanoutMode and omit explicit target keys.",
        );
      }
      const targetingFields = {
        ...(targetSessionKey ? { targetSessionKey } : {}),
