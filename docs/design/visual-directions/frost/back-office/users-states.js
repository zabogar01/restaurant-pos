/* DESIGN-023 review cases: no credential values. */
window.USER_CASES = {
  "default": {},
  "only-manager": {},
  "loading": {},
  "load-error": {},
  "overflow": {},
  "create-kitchen": {
    "op": "create",
    "target": "KITCHEN"
  },
  "saving-create-kitchen": {
    "op": "create",
    "target": "KITCHEN",
    "result": "pending",
    "draft": true
  },
  "saved-create-kitchen": {
    "op": "create",
    "target": "KITCHEN",
    "result": "saved",
    "draft": true
  },
  "create-cashier": {
    "op": "create",
    "target": "CASHIER"
  },
  "saving-create-cashier": {
    "op": "create",
    "target": "CASHIER",
    "result": "pending",
    "draft": true
  },
  "saved-create-cashier": {
    "op": "create",
    "target": "CASHIER",
    "result": "saved",
    "draft": true
  },
  "create-manager": {
    "op": "create",
    "target": "MANAGER"
  },
  "saving-create-manager": {
    "op": "create",
    "target": "MANAGER",
    "result": "pending",
    "draft": true
  },
  "saved-create-manager": {
    "op": "create",
    "target": "MANAGER",
    "result": "saved",
    "draft": true
  },
  "move-kitchen-cashier": {
    "op": "move",
    "id": "halim",
    "target": "CASHIER"
  },
  "saving-move-kitchen-cashier": {
    "op": "move",
    "id": "halim",
    "target": "CASHIER",
    "result": "pending",
    "draft": true
  },
  "saved-move-kitchen-cashier": {
    "op": "move",
    "id": "halim",
    "target": "CASHIER",
    "result": "saved",
    "draft": true
  },
  "move-kitchen-manager": {
    "op": "move",
    "id": "halim",
    "target": "MANAGER"
  },
  "saving-move-kitchen-manager": {
    "op": "move",
    "id": "halim",
    "target": "MANAGER",
    "result": "pending",
    "draft": true
  },
  "saved-move-kitchen-manager": {
    "op": "move",
    "id": "halim",
    "target": "MANAGER",
    "result": "saved",
    "draft": true
  },
  "move-cashier-kitchen": {
    "op": "move",
    "id": "ana",
    "target": "KITCHEN"
  },
  "saving-move-cashier-kitchen": {
    "op": "move",
    "id": "ana",
    "target": "KITCHEN",
    "result": "pending",
    "draft": true
  },
  "saved-move-cashier-kitchen": {
    "op": "move",
    "id": "ana",
    "target": "KITCHEN",
    "result": "saved",
    "draft": true
  },
  "move-cashier-manager": {
    "op": "move",
    "id": "ana",
    "target": "MANAGER"
  },
  "saving-move-cashier-manager": {
    "op": "move",
    "id": "ana",
    "target": "MANAGER",
    "result": "pending",
    "draft": true
  },
  "saved-move-cashier-manager": {
    "op": "move",
    "id": "ana",
    "target": "MANAGER",
    "result": "saved",
    "draft": true
  },
  "move-manager-kitchen": {
    "op": "move",
    "id": "ayu",
    "target": "KITCHEN"
  },
  "saving-move-manager-kitchen": {
    "op": "move",
    "id": "ayu",
    "target": "KITCHEN",
    "result": "pending",
    "draft": true
  },
  "saved-move-manager-kitchen": {
    "op": "move",
    "id": "ayu",
    "target": "KITCHEN",
    "result": "saved",
    "draft": true
  },
  "move-manager-cashier": {
    "op": "move",
    "id": "ayu",
    "target": "CASHIER"
  },
  "saving-move-manager-cashier": {
    "op": "move",
    "id": "ayu",
    "target": "CASHIER",
    "result": "pending",
    "draft": true
  },
  "saved-move-manager-cashier": {
    "op": "move",
    "id": "ayu",
    "target": "CASHIER",
    "result": "saved",
    "draft": true
  },
  "move-former-manager": {
    "op": "move",
    "id": "putra",
    "target": "MANAGER"
  },
  "saving-move-former-manager": {
    "op": "move",
    "id": "putra",
    "target": "MANAGER",
    "result": "pending",
    "draft": true
  },
  "saved-move-former-manager": {
    "op": "move",
    "id": "putra",
    "target": "MANAGER",
    "result": "saved",
    "draft": true
  },
  "pin-cashier": {
    "op": "pin",
    "id": "ana"
  },
  "saving-pin-cashier": {
    "op": "pin",
    "id": "ana",
    "result": "pending",
    "draft": true
  },
  "saved-pin-cashier": {
    "op": "pin",
    "id": "ana",
    "result": "saved",
    "draft": true
  },
  "pin-manager": {
    "op": "pin",
    "id": "ayu"
  },
  "saving-pin-manager": {
    "op": "pin",
    "id": "ayu",
    "result": "pending",
    "draft": true
  },
  "saved-pin-manager": {
    "op": "pin",
    "id": "ayu",
    "result": "saved",
    "draft": true
  },
  "password-manager": {
    "op": "password",
    "id": "ayu"
  },
  "saving-password-manager": {
    "op": "password",
    "id": "ayu",
    "result": "pending",
    "draft": true
  },
  "saved-password-manager": {
    "op": "password",
    "id": "ayu",
    "result": "saved",
    "draft": true
  },
  "own-password": {
    "op": "own-password",
    "id": "iqbal"
  },
  "saving-own-password": {
    "op": "own-password",
    "id": "iqbal",
    "result": "pending",
    "draft": true
  },
  "saved-own-password": {
    "op": "own-password",
    "id": "iqbal",
    "result": "saved",
    "draft": true
  },
  "own-pin": {
    "op": "own-pin",
    "id": "iqbal"
  },
  "saving-own-pin": {
    "op": "own-pin",
    "id": "iqbal",
    "result": "pending",
    "draft": true
  },
  "saved-own-pin": {
    "op": "own-pin",
    "id": "iqbal",
    "result": "saved",
    "draft": true
  },
  "classification-switch": {
    "op": "create",
    "target": "CASHIER",
    "switch": true
  },
  "duplicate-pin-create-cashier": {
    "op": "create",
    "target": "CASHIER",
    "result": "duplicate-pin",
    "draft": true
  },
  "duplicate-pin-create-manager": {
    "op": "create",
    "target": "MANAGER",
    "result": "duplicate-pin",
    "draft": true
  },
  "duplicate-pin-move-kitchen-cashier": {
    "op": "move",
    "id": "halim",
    "target": "CASHIER",
    "result": "duplicate-pin",
    "draft": true
  },
  "duplicate-pin-move-kitchen-manager": {
    "op": "move",
    "id": "halim",
    "target": "MANAGER",
    "result": "duplicate-pin",
    "draft": true
  },
  "duplicate-pin-pin-cashier": {
    "op": "pin",
    "id": "ana",
    "result": "duplicate-pin",
    "draft": true
  },
  "duplicate-pin-pin-manager": {
    "op": "pin",
    "id": "ayu",
    "result": "duplicate-pin",
    "draft": true
  },
  "duplicate-pin-own-pin": {
    "op": "own-pin",
    "id": "iqbal",
    "result": "duplicate-pin",
    "draft": true
  },
  "duplicate-username-create-manager": {
    "op": "create",
    "target": "MANAGER",
    "result": "duplicate-username",
    "draft": true
  },
  "duplicate-username-move-cashier-manager": {
    "op": "move",
    "id": "ana",
    "target": "MANAGER",
    "result": "duplicate-username",
    "draft": true
  },
  "duplicate-username-move-kitchen-manager": {
    "op": "move",
    "id": "halim",
    "target": "MANAGER",
    "result": "duplicate-username",
    "draft": true
  },
  "wrong-password-own-password": {
    "op": "own-password",
    "id": "iqbal",
    "result": "wrong-password"
  },
  "throttled-own-password": {
    "op": "own-password",
    "id": "iqbal",
    "result": "throttled"
  },
  "cooldown-started-own-password": {
    "op": "own-password",
    "id": "iqbal",
    "result": "wrong-password-cooldown"
  },
  "wrong-password-own-pin": {
    "op": "own-pin",
    "id": "iqbal",
    "result": "wrong-password"
  },
  "throttled-own-pin": {
    "op": "own-pin",
    "id": "iqbal",
    "result": "throttled"
  },
  "cooldown-started-own-pin": {
    "op": "own-pin",
    "id": "iqbal",
    "result": "wrong-password-cooldown"
  },
  "deactivate-cashier": {
    "op": "deactivate",
    "id": "ana"
  },
  "deactivated-cashier": {
    "op": "deactivate",
    "id": "ana",
    "result": "saved"
  },
  "deactivate-manager": {
    "op": "deactivate",
    "id": "ayu"
  },
  "deactivated-manager": {
    "op": "deactivate",
    "id": "ayu",
    "result": "saved"
  },
  "deactivate-kitchen": {
    "op": "deactivate",
    "id": "halim"
  },
  "deactivated-kitchen": {
    "op": "deactivate",
    "id": "halim",
    "result": "saved"
  },
  "reactivate-cashier": {
    "op": "reactivate",
    "id": "sari"
  },
  "reactivated-cashier": {
    "op": "reactivate",
    "id": "sari",
    "result": "saved"
  },
  "reactivate-manager": {
    "op": "reactivate",
    "id": "dewi"
  },
  "reactivated-manager": {
    "op": "reactivate",
    "id": "dewi",
    "result": "saved"
  },
  "reactivate-kitchen": {
    "op": "reactivate",
    "id": "wibowo"
  },
  "reactivated-kitchen": {
    "op": "reactivate",
    "id": "wibowo",
    "result": "saved"
  },
  "reactivate-pin-needed": {
    "op": "reactivate",
    "id": "sari",
    "result": "duplicate-pin"
  },
  "saving-reactivate-pin": {
    "op": "reactivate",
    "id": "sari",
    "form": true,
    "result": "pending"
  },
  "saved-reactivate-pin": {
    "op": "reactivate",
    "id": "sari",
    "form": true,
    "result": "saved"
  },
  "failure": {
    "op": "pin",
    "id": "ana",
    "result": "failure"
  },
  "not-found": {
    "op": "pin",
    "id": "ana",
    "result": "not-found"
  },
  "user-changed": {
    "op": "pin",
    "id": "ana",
    "result": "user-changed"
  },
  "user-changed-read-failed": {
    "op": "move",
    "id": "ana",
    "target": "MANAGER",
    "result": "user-changed",
    "partial": true
  },
  "own-account": {
    "op": "move",
    "id": "iqbal",
    "target": "CASHIER",
    "result": "own-account"
  },
  "unknown-pin-cashier": {
    "op": "pin",
    "id": "ana",
    "result": "unknown"
  },
  "unknown-password-manager": {
    "op": "password",
    "id": "ayu",
    "result": "unknown"
  },
  "unknown-move-cashier-manager": {
    "op": "move",
    "id": "ana",
    "target": "MANAGER",
    "result": "unknown"
  },
  "unknown-move-applied": {
    "op": "move",
    "id": "ana",
    "target": "MANAGER",
    "result": "unknown-applied"
  },
  "unknown-own-password": {
    "op": "own-password",
    "id": "iqbal",
    "result": "unknown"
  },
  "unknown-read-failed": {
    "op": "pin",
    "id": "ana",
    "result": "unknown-read-failed"
  },
  "pending-deactivate": {
    "op": "deactivate",
    "id": "ana",
    "result": "pending"
  },
  "unknown-deactivate": {
    "op": "deactivate",
    "id": "ana",
    "result": "unknown"
  },
  "failure-deactivate": {
    "op": "deactivate",
    "id": "ana",
    "result": "failure"
  },
  "pending-reactivate": {
    "op": "reactivate",
    "id": "sari",
    "result": "pending"
  },
  "unknown-reactivate": {
    "op": "reactivate",
    "id": "sari",
    "result": "unknown"
  },
  "failure-reactivate": {
    "op": "reactivate",
    "id": "sari",
    "result": "failure"
  },
  "partial": {
    "op": "create",
    "target": "KITCHEN",
    "result": "saved",
    "partial": true
  },
  "unsaved": {
    "op": "create",
    "target": "MANAGER",
    "draft": true,
    "leave": "cancel"
  },
  "unsaved-logout": {
    "op": "create",
    "target": "MANAGER",
    "draft": true,
    "leave": "logout"
  },
  "leave-pending": {
    "op": "create",
    "target": "MANAGER",
    "draft": true,
    "result": "pending",
    "leave": "cancel"
  },
  "leave-unknown": {
    "op": "create",
    "target": "MANAGER",
    "draft": true,
    "result": "unknown",
    "leave": "cancel"
  },
  "reauth": {
    "op": "create",
    "target": "MANAGER",
    "draft": true,
    "gate": "idle"
  },
  "bo01-draft": {
    "op": "create",
    "target": "MANAGER",
    "draft": true,
    "gate": "ended"
  },
  "draft-restored": {
    "op": "create",
    "target": "MANAGER",
    "draft": true,
    "restored": true
  },
  "reauth-decision": {
    "op": "create",
    "target": "MANAGER",
    "draft": true,
    "leave": "cancel",
    "gate": "idle"
  },
  "bo01-decision": {
    "op": "create",
    "target": "MANAGER",
    "draft": true,
    "leave": "cancel",
    "gate": "ended"
  },
  "reauth-confirm": {
    "op": "deactivate",
    "id": "ana",
    "gate": "idle"
  },
  "bo01-confirm": {
    "op": "deactivate",
    "id": "ana",
    "gate": "ended"
  },
  "invalid-name-empty": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "name",
      "Enter a name."
    ]
  },
  "invalid-name-long": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "name",
      "Use 64 characters or fewer."
    ]
  },
  "invalid-name-control": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "name",
      "Remove control characters from the name."
    ]
  },
  "invalid-pin-empty": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "pin",
      "Enter exactly six digits, 0–9."
    ]
  },
  "invalid-pin-short": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "pin",
      "Enter exactly six digits, 0–9."
    ]
  },
  "invalid-pin-format": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "pin",
      "Enter exactly six digits, 0–9."
    ]
  },
  "invalid-username-empty": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "username",
      "Use 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit."
    ]
  },
  "invalid-username-short": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "username",
      "Use 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit."
    ]
  },
  "invalid-username-long": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "username",
      "Use 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit."
    ]
  },
  "invalid-username-format": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "username",
      "Use 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit."
    ]
  },
  "invalid-password-short": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "password",
      "Use 8–128 characters. Spaces count."
    ]
  },
  "invalid-password-long": {
    "op": "create",
    "id": null,
    "target": "MANAGER",
    "error": [
      "password",
      "Use 8–128 characters. Spaces count."
    ]
  },
  "invalid-currentPassword-empty": {
    "op": "own-password",
    "id": "iqbal",
    "target": "MANAGER",
    "error": [
      "currentPassword",
      "Enter your current password."
    ]
  },
  "invalid-currentPassword-long": {
    "op": "own-password",
    "id": "iqbal",
    "target": "MANAGER",
    "error": [
      "currentPassword",
      "Use 1024 characters or fewer."
    ]
  }
};
window.WF = {
  "id": "BO-06",
  "client": "bo",
  "nav": "users",
  "name": "Staff",
  "reqs": "FR-A1, A3, A4, B3, J3, J4; AC-32; C3",
  "states": [
    [
      "default",
      "Active and inactive staff"
    ],
    [
      "only-manager",
      "Only the signed-in manager"
    ],
    [
      "loading",
      "Reading staff"
    ],
    [
      "load-error",
      "Staff read failed"
    ],
    [
      "overflow",
      "Long list · 64-character name and 32-character username"
    ],
    [
      "create-kitchen",
      "Create kitchen"
    ],
    [
      "saving-create-kitchen",
      "Saving · create kitchen"
    ],
    [
      "saved-create-kitchen",
      "Saved · create kitchen"
    ],
    [
      "create-cashier",
      "Create cashier"
    ],
    [
      "saving-create-cashier",
      "Saving · create cashier"
    ],
    [
      "saved-create-cashier",
      "Saved · create cashier"
    ],
    [
      "create-manager",
      "Create manager"
    ],
    [
      "saving-create-manager",
      "Saving · create manager"
    ],
    [
      "saved-create-manager",
      "Saved · create manager"
    ],
    [
      "move-kitchen-cashier",
      "Move kitchen cashier"
    ],
    [
      "saving-move-kitchen-cashier",
      "Saving · move kitchen cashier"
    ],
    [
      "saved-move-kitchen-cashier",
      "Saved · move kitchen cashier"
    ],
    [
      "move-kitchen-manager",
      "Move kitchen manager"
    ],
    [
      "saving-move-kitchen-manager",
      "Saving · move kitchen manager"
    ],
    [
      "saved-move-kitchen-manager",
      "Saved · move kitchen manager"
    ],
    [
      "move-cashier-kitchen",
      "Move cashier kitchen"
    ],
    [
      "saving-move-cashier-kitchen",
      "Saving · move cashier kitchen"
    ],
    [
      "saved-move-cashier-kitchen",
      "Saved · move cashier kitchen"
    ],
    [
      "move-cashier-manager",
      "Move cashier manager"
    ],
    [
      "saving-move-cashier-manager",
      "Saving · move cashier manager"
    ],
    [
      "saved-move-cashier-manager",
      "Saved · move cashier manager"
    ],
    [
      "move-manager-kitchen",
      "Move manager kitchen"
    ],
    [
      "saving-move-manager-kitchen",
      "Saving · move manager kitchen"
    ],
    [
      "saved-move-manager-kitchen",
      "Saved · move manager kitchen"
    ],
    [
      "move-manager-cashier",
      "Move manager cashier"
    ],
    [
      "saving-move-manager-cashier",
      "Saving · move manager cashier"
    ],
    [
      "saved-move-manager-cashier",
      "Saved · move manager cashier"
    ],
    [
      "move-former-manager",
      "Move former manager"
    ],
    [
      "saving-move-former-manager",
      "Saving · move former manager"
    ],
    [
      "saved-move-former-manager",
      "Saved · move former manager"
    ],
    [
      "pin-cashier",
      "Pin cashier"
    ],
    [
      "saving-pin-cashier",
      "Saving · pin cashier"
    ],
    [
      "saved-pin-cashier",
      "Saved · pin cashier"
    ],
    [
      "pin-manager",
      "Pin manager"
    ],
    [
      "saving-pin-manager",
      "Saving · pin manager"
    ],
    [
      "saved-pin-manager",
      "Saved · pin manager"
    ],
    [
      "password-manager",
      "Password manager"
    ],
    [
      "saving-password-manager",
      "Saving · password manager"
    ],
    [
      "saved-password-manager",
      "Saved · password manager"
    ],
    [
      "own-password",
      "Own password"
    ],
    [
      "saving-own-password",
      "Saving · own password"
    ],
    [
      "saved-own-password",
      "Saved · own password"
    ],
    [
      "own-pin",
      "Own pin"
    ],
    [
      "saving-own-pin",
      "Saving · own pin"
    ],
    [
      "saved-own-pin",
      "Saved · own pin"
    ],
    [
      "classification-switch",
      "Classification changed · name kept, credentials empty"
    ],
    [
      "duplicate-pin-create-cashier",
      "PIN in use · create cashier"
    ],
    [
      "duplicate-pin-create-manager",
      "PIN in use · create manager"
    ],
    [
      "duplicate-pin-move-kitchen-cashier",
      "PIN in use · move kitchen cashier"
    ],
    [
      "duplicate-pin-move-kitchen-manager",
      "PIN in use · move kitchen manager"
    ],
    [
      "duplicate-pin-pin-cashier",
      "PIN in use · pin cashier"
    ],
    [
      "duplicate-pin-pin-manager",
      "PIN in use · pin manager"
    ],
    [
      "duplicate-pin-own-pin",
      "PIN in use · own pin"
    ],
    [
      "duplicate-username-create-manager",
      "Username in use · create manager"
    ],
    [
      "duplicate-username-move-cashier-manager",
      "Username in use · move cashier manager"
    ],
    [
      "duplicate-username-move-kitchen-manager",
      "Username in use · move kitchen manager"
    ],
    [
      "wrong-password-own-password",
      "wrong password · own-password"
    ],
    [
      "throttled-own-password",
      "throttled · own-password"
    ],
    [
      "cooldown-started-own-password",
      "Wrong password starts cooldown · own-password"
    ],
    [
      "wrong-password-own-pin",
      "wrong password · own-pin"
    ],
    [
      "throttled-own-pin",
      "throttled · own-pin"
    ],
    [
      "cooldown-started-own-pin",
      "Wrong password starts cooldown · own-pin"
    ],
    [
      "deactivate-cashier",
      "Confirm deactivation · cashier"
    ],
    [
      "deactivated-cashier",
      "Deactivated · cashier"
    ],
    [
      "deactivate-manager",
      "Confirm deactivation · manager"
    ],
    [
      "deactivated-manager",
      "Deactivated · manager"
    ],
    [
      "deactivate-kitchen",
      "Confirm deactivation · kitchen"
    ],
    [
      "deactivated-kitchen",
      "Deactivated · kitchen"
    ],
    [
      "reactivate-cashier",
      "Reactivating · cashier"
    ],
    [
      "reactivated-cashier",
      "Reactivated · cashier"
    ],
    [
      "reactivate-manager",
      "Reactivating · manager"
    ],
    [
      "reactivated-manager",
      "Reactivated · manager"
    ],
    [
      "reactivate-kitchen",
      "Reactivating · kitchen"
    ],
    [
      "reactivated-kitchen",
      "Reactivated · kitchen"
    ],
    [
      "reactivate-pin-needed",
      "Reactivation refused · a new PIN is needed"
    ],
    [
      "saving-reactivate-pin",
      "Saving reactivation with a new PIN"
    ],
    [
      "saved-reactivate-pin",
      "Reactivated with a new PIN"
    ],
    [
      "failure",
      "Failure"
    ],
    [
      "not-found",
      "Not found"
    ],
    [
      "user-changed",
      "User changed"
    ],
    [
      "user-changed-read-failed",
      "Person changed · reread failed"
    ],
    [
      "own-account",
      "Own-account command refused"
    ],
    [
      "unknown-pin-cashier",
      "Unknown outcome · pin-cashier"
    ],
    [
      "unknown-password-manager",
      "Unknown outcome · password-manager"
    ],
    [
      "unknown-move-cashier-manager",
      "Unknown outcome · move-cashier-manager"
    ],
    [
      "unknown-move-applied",
      "Unknown move · reread shows the new classification"
    ],
    [
      "unknown-own-password",
      "Unknown outcome · own-password"
    ],
    [
      "unknown-read-failed",
      "Unknown reset · list could not be refreshed"
    ],
    [
      "pending-deactivate",
      "Pending · deactivate"
    ],
    [
      "unknown-deactivate",
      "Unknown · deactivate"
    ],
    [
      "failure-deactivate",
      "Failure · deactivate"
    ],
    [
      "pending-reactivate",
      "Pending · reactivate"
    ],
    [
      "unknown-reactivate",
      "Unknown · reactivate"
    ],
    [
      "failure-reactivate",
      "Failure · reactivate"
    ],
    [
      "partial",
      "Saved while full staff read still fails"
    ],
    [
      "unsaved",
      "Stay or Discard"
    ],
    [
      "unsaved-logout",
      "Log out with a draft"
    ],
    [
      "leave-pending",
      "Leave while saving"
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
      "BO-01 with isolated draft"
    ],
    [
      "draft-restored",
      "Same manager returns · credential fields empty"
    ],
    [
      "reauth-decision",
      "M-6 over departure decision"
    ],
    [
      "bo01-decision",
      "BO-01 with departure held"
    ],
    [
      "reauth-confirm",
      "Session gate over deactivation"
    ],
    [
      "bo01-confirm",
      "Session gate over deactivation"
    ],
    [
      "invalid-name-empty",
      "Local refusal · name-empty"
    ],
    [
      "invalid-name-long",
      "Local refusal · name-long"
    ],
    [
      "invalid-name-control",
      "Local refusal · name-control"
    ],
    [
      "invalid-pin-empty",
      "Local refusal · pin-empty"
    ],
    [
      "invalid-pin-short",
      "Local refusal · pin-short"
    ],
    [
      "invalid-pin-format",
      "Local refusal · pin-format"
    ],
    [
      "invalid-username-empty",
      "Local refusal · username-empty"
    ],
    [
      "invalid-username-short",
      "Local refusal · username-short"
    ],
    [
      "invalid-username-long",
      "Local refusal · username-long"
    ],
    [
      "invalid-username-format",
      "Local refusal · username-format"
    ],
    [
      "invalid-password-short",
      "Local refusal · password-short"
    ],
    [
      "invalid-password-long",
      "Local refusal · password-long"
    ],
    [
      "invalid-currentPassword-empty",
      "Local refusal · currentPassword-empty"
    ],
    [
      "invalid-currentPassword-long",
      "Local refusal · currentPassword-long"
    ]
  ]
};
