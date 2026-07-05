    ]);
  });

  it("case 12: schema conflict takes precedence over policy rejection", async () => {
    const error = await expectContinueDelegateError({
      crossSessionTargeting: "disabled",
      args: { fanoutMode: "tree", targetSessionKey: "agent:main:other" },
    });

    expect(error.message).toContain(
      "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys.",
    );
    expect(error.message).not.toContain("cross-session continuation targeting is disabled");
    expect(consumePendingDelegates(DISPATCHING_SESSION)).toEqual([]);
  });
