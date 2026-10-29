/* DESIGN-022 review states. */
window.WF={
  "id": "BO-07",
  "client": "bo",
  "nav": "presets",
  "name": "Discount presets",
  "reqs": "FR-B5, F2, F4, F5, M5; ADR-012; C1 §4; C2",
  "states": [
    [
      "default",
      "Active and inactive presets"
    ],
    [
      "empty",
      "No presets yet"
    ],
    [
      "loading",
      "Reading presets"
    ],
    [
      "load-error",
      "Read failed"
    ],
    [
      "overflow",
      "Long list and maximum values"
    ],
    [
      "create-percent",
      "New percentage preset"
    ],
    [
      "create-fixed",
      "New fixed-amount preset"
    ],
    [
      "edit-percent",
      "Edit percentage preset"
    ],
    [
      "edit-fixed",
      "Edit fixed-amount preset"
    ],
    [
      "kind-switch",
      "Changed kind; both typed values kept"
    ],
    [
      "edit-inactive",
      "Edit an inactive preset"
    ],
    [
      "saving",
      "Save pending"
    ],
    [
      "saved",
      "Named save result"
    ],
    [
      "unchanged",
      "No change; current version"
    ],
    [
      "duplicate-create",
      "Name in use on create"
    ],
    [
      "duplicate-edit",
      "Name in use on edit"
    ],
    [
      "duplicate-reactivate",
      "Name in use on reactivation"
    ],
    [
      "stale",
      "Catalog changed; preset differs"
    ],
    [
      "stale-menu",
      "Only the menu changed; preset values match"
    ],
    [
      "stale-reauth",
      "Stale draft refused after M-6"
    ],
    [
      "stale-read-failed",
      "Stale draft; current read failed"
    ],
    [
      "deactivate",
      "Confirm named deactivation"
    ],
    [
      "deactivated",
      "Preset hidden from POS picker"
    ],
    [
      "reactivated",
      "Preset offered again"
    ],
    [
      "pending-deactivate",
      "Deactivation pending"
    ],
    [
      "pending-reactivate",
      "Reactivation pending"
    ],
    [
      "unknown-deactivate",
      "Deactivation outcome unknown"
    ],
    [
      "unknown-reactivate",
      "Reactivation outcome unknown"
    ],
    [
      "status-failure",
      "State command definitely refused"
    ],
    [
      "failure",
      "Save definitely refused; draft kept"
    ],
    [
      "not-found",
      "Unknown preset; draft kept and list reread"
    ],
    [
      "unknown",
      "Save outcome unknown; version unchanged"
    ],
    [
      "unknown-changed",
      "Unknown outcome; newer catalog version"
    ],
    [
      "unknown-read-failed",
      "Unknown outcome; reread failed"
    ],
    [
      "partial",
      "Saved while list read stands failed"
    ],
    [
      "unsaved",
      "Cancel; Stay or Discard"
    ],
    [
      "unsaved-switch",
      "Open another preset with a draft"
    ],
    [
      "unsaved-logout",
      "Log out with a draft"
    ],
    [
      "leave-pending",
      "Leave during pending save"
    ],
    [
      "leave-unknown",
      "Leave after unknown outcome"
    ],
    [
      "reauth",
      "M-6 over inert draft"
    ],
    [
      "bo01-draft",
      "BO-01 with local draft held"
    ],
    [
      "reauth-confirm",
      "M-6 over deactivation confirmation"
    ],
    [
      "bo01-confirm",
      "BO-01 with confirmation held"
    ],
    [
      "reauth-decision",
      "M-6 over departure decision"
    ],
    [
      "bo01-decision",
      "BO-01 with departure decision held"
    ],
    [
      "invalid-name-empty",
      "Name — empty"
    ],
    [
      "invalid-name-long",
      "Name — long"
    ],
    [
      "invalid-name-control",
      "Name — control"
    ],
    [
      "invalid-percent-empty",
      "Percent — empty"
    ],
    [
      "invalid-percent-negative",
      "Percent — negative"
    ],
    [
      "invalid-percent-format",
      "Percent — format"
    ],
    [
      "invalid-percent-decimals",
      "Percent — decimals"
    ],
    [
      "invalid-percent-over",
      "Percent — over"
    ],
    [
      "invalid-amount-empty",
      "Amount — empty"
    ],
    [
      "invalid-amount-negative",
      "Amount — negative"
    ],
    [
      "invalid-amount-format",
      "Amount — format"
    ],
    [
      "invalid-amount-over",
      "Amount — over"
    ]
  ]
};
