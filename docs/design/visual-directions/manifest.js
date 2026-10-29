window.MOCKUPS = [
  {
    "path": "pos/order.html",
    "title": "Order workspace",
    "states": [
      [
        "default",
        "Table order — 2 rounds fired"
      ],
      [
        "empty",
        "Table order — no lines"
      ],
      [
        "quick",
        "Quick sale"
      ],
      ["open-t7", "Table 7 — your payment"],
      ["open-t9", "Table 9 — 2 lines fired"],
      ["open-t12", "Table 12 — 2 rounds and pending"],
      ["quick-new", "New quick sale — empty"],
      [
        "linecontrols",
        "Line controls — pending vs fired"
      ],
      [
        "quick-line",
        "Quick sale — line editor"
      ],
      [
        "overflow",
        "Overflow — long order"
      ],
      [
        "zero",
        "Zero total (100% comp)"
      ],
      [
        "eightysix",
        "Item 86’d — disabled in place"
      ],
      [
        "fireblocked",
        "Fire blocked — 86’d pending line"
      ],
      [
        "catalog",
        "CATALOG_CHANGED"
      ],
      [
        "lock-draft",
        "Locked — your payment"
      ],
      [
        "lock-lease",
        "Locked — another client"
      ],
      [
        "fireerror",
        "Fire printed FAILED"
      ],
      [
        "loading",
        "Loading"
      ],
      [
        "error",
        "Command rejected"
      ],
      [
        "sheet-item",
        "Sheet — item configuration"
      ],
      [
        "sheet-item86",
        "Sheet — item 86’d mid-selection"
      ],
      [
        "sheet-line",
        "Sheet — line editor"
      ],
      [
        "sheet-discount",
        "Sheet — preset picker"
      ],
      [
        "sheet-freeform",
        "Sheet — free-form discount"
      ],
      [
        "sheet-remove",
        "Sheet — remove/replace discount"
      ],
      [
        "sheet-voidline",
        "Sheet — void fired line"
      ],
      [
        "sheet-voidorder",
        "Sheet — void order (unfired)"
      ],
      [
        "sheet-voidorder-fired",
        "Sheet — void order (holds fired)"
      ],
      [
        "approval",
        "Modal — manager approval"
      ],
      [
        "approval-error",
        "Modal — wrong PIN"
      ],
      [
        "approval-throttled",
        "Modal — approval cooldown"
      ],
      [
        "approval-denied",
        "Modal — approval failure (alias)"
      ]
    ],
    "width": 1280,
    "height": 800
  },
  {
    "path": "pos/settlement.html",
    "title": "Settlement",
    "states": [
      [
        "empty",
        "No payment drafted — cash"
      ],
      [
        "card",
        "Card — balance already filled in"
      ],
      [
        "exact",
        "Exact — card in full"
      ],
      [
        "exactcash",
        "Exact — cash in full"
      ],
      [
        "cardsplit",
        "Card — 100.000 keyed, splitting"
      ],
      [
        "partial",
        "Split — 55.925 still owing"
      ],
      [
        "exactsplit",
        "Exact — 100.000 card + 55.925 cash (AC-7)"
      ],
      [
        "cashover",
        "Cash — 200.000 keyed over the balance"
      ],
      [
        "change",
        "Cash over — change due (AC-5)"
      ],
      [
        "cardover",
        "Card over balance — rejected (AC-6)"
      ],
      [
        "ceiling",
        "Change ceiling exceeded"
      ],
      [
        "zero",
        "Zero total"
      ],
      [
        "pending",
        "Blocked — pending lines"
      ],
      [
        "overflow",
        "Overflow — many splits"
      ],
      [
        "reauth",
        "Re-authenticate to close"
      ],
      [
        "cancel",
        "Cancel payment"
      ],
      [
        "leaselost",
        "Lease lost — displaced"
      ],
      [
        "takeover",
        "Manager takeover"
      ],
      [
        "loading",
        "Closing"
      ],
      [
        "error",
        "Close rejected"
      ]
    ],
    "width": 1280,
    "height": 800
  },
  {
    "path": "pos/lock.html",
    "title": "Lock / PIN entry",
    "states": [
      [
        "default",
        "Resting"
      ],
      ["short-pin", "Short PIN"],
      ["ready", "Six digits entered"],
      ["unavailable", "System unavailable"],
      ["unexpected", "Something went wrong"],
      [
        "loading",
        "Verifying"
      ],
      [
        "error",
        "Wrong PIN"
      ],
      [
        "throttled",
        "LOGIN cooldown"
      ],
      [
        "invalidated",
        "Session invalidated"
      ],
      [
        "draft",
        "Tender draft waiting"
      ],
      [
        "incident",
        "Kitchen printer emergency"
      ]
    ],
    "width": 1280,
    "height": 800
  },
  {
    "path": "pos/incidents.html",
    "title": "Print incidents",
    "states": [
      [
        "default",
        "Kitchen emergency + receipt warning"
      ],
      [
        "cancel",
        "Cancellation ticket UNKNOWN"
      ],
      [
        "empty",
        "Nothing outstanding"
      ],
      [
        "reprint",
        "Reprint result"
      ],
      [
        "overflow",
        "Overflow"
      ],
      [
        "loading",
        "Loading"
      ],
      [
        "error",
        "Error"
      ],
      [
        "reprint-cancel",
        "Cancellation reprint sent"
      ],
      [
        "reprint-receipt",
        "Receipt reprint sent"
      ],
      [
        "reprint-table9",
        "Table 9 reprint sent"
      ],
      [
        "reprint-counter",
        "Counter receipt reprint sent"
      ],
      [
        "reprint-printed",
        "Server-confirmed print result"
      ]
    ],
    "width": 1280,
    "height": 800
  },
  {
    "path": "back-office/menu.html",
    "title": "Menu — items and categories",
    "states": [
      [
        "default",
        "Grouped menu"
      ],
      [
        "empty",
        "New installation — no menu"
      ],
      [
        "loading",
        "Loading"
      ],
      [
        "error",
        "Failed to load"
      ],
      [
        "overflow",
        "Long menu — longest names"
      ],
      [
        "kitchen",
        "Kitchen emergency"
      ],
      [
        "category",
        "Create category"
      ],
      [
        "rename",
        "Rename category"
      ],
      [
        "rename-archived",
        "Rename archived category"
      ],
      [
        "category-invalid",
        "Category — empty name refused"
      ],
      [
        "invalid-long",
        "Category — name too long"
      ],
      [
        "invalid-control",
        "Category — control character"
      ],
      [
        "saving",
        "Category — saving"
      ],
      [
        "saved",
        "Category — saved"
      ],
      [
        "duplicate-create",
        "Create — name in use"
      ],
      [
        "duplicate-rename",
        "Rename — name in use"
      ],
      [
        "duplicate-category-restore",
        "Restore category — name in use"
      ],
      [
        "failure",
        "Category — definite failure"
      ],
      [
        "unknown",
        "Category — outcome unknown"
      ],
      [
        "unknown-changed",
        "Rename — unknown outcome, newer menu"
      ],
      [
        "unknown-read-failed",
        "Category — outcome unknown, read failed"
      ],
      [
        "stale",
        "Rename — catalog changed"
      ],
      [
        "stale-read-failed",
        "Rename — catalog changed, read failed"
      ],
      [
        "unsaved",
        "Departure decision"
      ],
      [
        "unsaved-logout",
        "Logout decision"
      ],
      [
        "leave-pending",
        "Departure — save pending"
      ],
      [
        "leave-unknown",
        "Departure — outcome unknown"
      ],
      [
        "reauth",
        "M-6 over category draft"
      ],
      [
        "bo01-draft",
        "BO-01 with category draft held"
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
        "eightysix",
        "Item marked 86"
      ],
      [
        "available",
        "Item available again"
      ],
      [
        "category-archived",
        "Category archived — items retained"
      ],
      [
        "category-restored",
        "Category restored"
      ],
      [
        "item-archived",
        "Item archived"
      ],
      [
        "item-restored",
        "Item restored"
      ],
      [
        "duplicate-item-restore",
        "Restore item — name in use"
      ],
      [
        "partial",
        "Menu list may be out of date"
      ],
      [
        "leaserejected",
        "Phase 4 only — 86 refused during quick-sale payment"
      ],
      [
        "pending-86",
        "86 — pending"
      ],
      [
        "unknown-86",
        "86 — unknown"
      ],
      [
        "failure-86",
        "86 — failure"
      ],
      [
        "session-86",
        "86 — session"
      ],
      [
        "pending-available",
        "available — pending"
      ],
      [
        "unknown-available",
        "available — unknown"
      ],
      [
        "failure-available",
        "available — failure"
      ],
      [
        "session-available",
        "available — session"
      ],
      [
        "pending-category-archive",
        "category-archive — pending"
      ],
      [
        "unknown-category-archive",
        "category-archive — unknown"
      ],
      [
        "failure-category-archive",
        "category-archive — failure"
      ],
      [
        "session-category-archive",
        "category-archive — session"
      ],
      [
        "pending-category-restore",
        "category-restore — pending"
      ],
      [
        "unknown-category-restore",
        "category-restore — unknown"
      ],
      [
        "failure-category-restore",
        "category-restore — failure"
      ],
      [
        "session-category-restore",
        "category-restore — session"
      ],
      [
        "pending-item-archive",
        "item-archive — pending"
      ],
      [
        "unknown-item-archive",
        "item-archive — unknown"
      ],
      [
        "failure-item-archive",
        "item-archive — failure"
      ],
      [
        "session-item-archive",
        "item-archive — session"
      ],
      [
        "pending-item-restore",
        "item-restore — pending"
      ],
      [
        "unknown-item-restore",
        "item-restore — unknown"
      ],
      [
        "failure-item-restore",
        "item-restore — failure"
      ],
      [
        "session-item-restore",
        "item-restore — session"
      ],
      [
        "reorder-categories-edit",
        "Reorder categories — edit"
      ],
      [
        "reorder-categories-pending",
        "Reorder categories — pending"
      ],
      [
        "reorder-categories-saved",
        "Reorder categories — saved"
      ],
      [
        "reorder-categories-stale",
        "Reorder categories — stale"
      ],
      [
        "reorder-categories-unknown",
        "Reorder categories — unknown"
      ],
      [
        "reorder-items-edit",
        "Reorder items — edit"
      ],
      [
        "reorder-items-pending",
        "Reorder items — pending"
      ],
      [
        "reorder-items-saved",
        "Reorder items — saved"
      ],
      [
        "reorder-items-stale",
        "Reorder items — stale"
      ],
      [
        "reorder-items-unknown",
        "Reorder items — unknown"
      ]
    ],
    "width": 1440,
    "height": 900,
    "paperStates": [
      [
        "kitchen",
        "Kitchen emergency"
      ],
      [
        "category-invalid",
        "Modal — category, empty name refused"
      ],
      [
        "default",
        "Items list"
      ],
      [
        "eightysix",
        "Item toggled to 86"
      ],
      [
        "leaserejected",
        "86 rejected — order being paid"
      ],
      [
        "empty",
        "No items yet"
      ],
      [
        "category",
        "Modal — category"
      ],
      [
        "loading",
        "Loading"
      ],
      [
        "error",
        "Error"
      ],
      [
        "overflow",
        "Overflow — long menu"
      ]
    ]
  },
  {
    "path": "back-office/report-detail.html",
    "title": "Report detail — immutable snapshot",
    "states": [
      ["kitchen", "Kitchen emergency"],
      [
        "default",
        "Stored report"
      ],
      [
        "emptyday",
        "Day with no trading"
      ],
      [
        "reprint",
        "Reprint result"
      ]
    ],
    "width": 1440,
    "height": 900
  },
  {
    "path": "pos/floor.html",
    "title": "Floor — tables and quick sale",
    "states": [
      [
        "default",
        "Mixed occupancy"
      ],
      [
        "clear",
        "All tables free"
      ],
      [
        "empty",
        "No tables configured"
      ],
      [
        "loading",
        "Loading"
      ],
      [
        "error",
        "Error"
      ],
      [
        "overflow",
        "24 tables — scroll"
      ],
      [
        "dayclosed",
        "Business day closed"
      ],
      [
        "incident",
        "Kitchen emergency"
      ],
      [
        "receipt-warning",
        "Receipt warning"
      ],
      [
        "after-close",
        "After Close \u00b7 Table 1 free"
      ],
      [
        "after-close-receipt",
        "After Close \u00b7 receipt warning"
      ]
    ],
    "width": 1280,
    "height": 800
  },
{
  "path": "pos/closed-orders.html",
  "title": "Closed Orders",
  "states": [
    [
      "default",
      "Closed orders"
    ],
    [
      "empty",
      "No closed orders"
    ],
    [
      "loading",
      "Loading"
    ],
    [
      "error",
      "Load failed"
    ],
    [
      "overflow",
      "Full trading day"
    ],
    [
      "nomatch",
      "No matching orders"
    ],
    [
      "dayclosed",
      "Day closed \u00b7 open day first"
    ],
    [
      "dayclosed-start",
      "Day closed \u00b7 no new-day order yet"
    ],
    [
      "filter-table",
      "Touch \u00b7 table picker"
    ],
    [
      "filter-time",
      "Touch \u00b7 time range"
    ],
    [
      "filter-amount",
      "Touch \u00b7 exact amount"
    ]
  ],
  "width": 1280,
  "height": 800
},
{
  "path": "pos/closed-order.html",
  "title": "Closed Order",
  "states": [
    [
      "default",
      "Card + cash"
    ],
    [
      "cash",
      "Cash with change"
    ],
    [
      "custom",
      "Custom-named tenders"
    ],
    [
      "quick",
      "Quick sale"
    ],
    [
      "zero",
      "Zero total \u00b7 no refund control"
    ],
    [
      "refunded",
      "REFUNDED"
    ],
    [
      "dayclosed",
      "Business day closed"
    ],
    [
      "sheet-refund",
      "Default refund allocation"
    ],
    [
      "sheet-ac25",
      "Cash contribution \u00b7 AC-25"
    ],
    [
      "sheet-custom",
      "Custom tender allocation"
    ],
    [
      "sheet-edited",
      "Edited \u00b7 exact sum"
    ],
    [
      "sheet-invalid",
      "Edited \u00b7 sum mismatch"
    ],
    [
      "sheet-zero",
      "Edited \u00b7 row set to 0"
    ],
    [
      "sheet-edit",
      "Touch \u00b7 edit amount"
    ],
    [
      "sheet-other",
      "Touch \u00b7 other reason"
    ],
    [
      "approval",
      "Manager PIN \u00b7 default allocation"
    ],
    [
      "approval-edited",
      "Manager PIN \u00b7 allocation edited"
    ],
    [
      "refund-error",
      "Refund command failed"
    ],
    [
      "refund-error-cash",
      "Cash-only refund failed · AC-25"
    ],
    [
      "day-refusal",
      "Day closed during attempt"
    ],
    [
      "reprint",
      "Receipt FAILED"
    ],
    [
      "reprint-unknown",
      "Receipt UNKNOWN"
    ],
    [
      "reprint-sent",
      "Reprint sent"
    ],
    [
      "reprint-printed",
      "Server result \u00b7 PRINTED"
    ],
    [
      "loading",
      "Loading"
    ],
    [
      "error",
      "Load failed"
    ],
    [
      "overflow",
      "Long order \u00b7 pinned figures"
    ]
  ],
  "width": 1280,
  "height": 800
},
  {
    "path": "back-office/shell.html",
    "title": "Office shell and M-6",
    "states": [
      [
        "none",
        "No alerts"
      ],
      [
        "kitchen",
        "Kitchen emergency"
      ],
      [
        "receipt",
        "Receipt warning"
      ],
      [
        "both",
        "Both alerts"
      ],
      [
        "reauth",
        "Re-authenticate"
      ],
      [
        "reauth-verifying",
        "Verification pending"
      ],
      [
        "reauth-error",
        "Wrong credential"
      ],
      ["reauth-other-confirm", "Choose another manager"],
      ["reauth-other", "Other manager sign-in"],
      ["reauth-other-error", "Other manager refusal"],
      ["reauth-other-throttled", "Other account cooldown"],
      ["reauth-other-verifying", "Other sign-in pending"],
      ["other-signed-in", "Separate working area"],
      [
        "reauth-throttled",
        "Account cooldown"
      ],
      [
        "reauth-logout",
        "Discard before logout"
      ],
      [
        "reauth-kitchen",
        "Kitchen failure during re-authentication"
      ],
      [
        "resumed",
        "Draft resumed"
      ],
      ["unsaved", "Leave the draft"]
    ],
    "width": 1440,
    "height": 900,
    "directions": [
      "frost"
    ]
  },
  {
    "path": "back-office/patterns.html",
    "title": "Shared desktop patterns",
    "states": [
      [
        "fields",
        "Fields — resting"
      ],
      [
        "fields-focused",
        "Fields — focus"
      ],
      [
        "fields-invalid",
        "Fields — invalid"
      ],
      [
        "fields-readonly",
        "Fields — read-only"
      ],
      [
        "fields-disabled",
        "Fields — disabled"
      ],
      [
        "dialog",
        "Dialog — contained scrolling"
      ],
      [
        "destructive",
        "Named destructive confirmation"
      ],
      [
        "loading",
        "Read pending"
      ],
      [
        "empty",
        "Empty collection"
      ],
      [
        "load-error",
        "Read failed"
      ],
      [
        "pending",
        "Command pending"
      ],
      [
        "saved",
        "Command saved"
      ],
      [
        "refused",
        "Command refused"
      ],
      [
        "unknown",
        "Outcome unknown — reread"
      ],
      [
        "reconciled",
        "Reread confirms saved"
      ],
      [
        "unsaved",
        "Leave unsaved work"
      ],
      [
        "table",
        "Table — first page"
      ],
      [
        "table-page-2",
        "Table — second page"
      ],
      [
        "row-detail",
        "Named row detail"
      ],
      [
        "removed",
        "Removal completed"
      ]
    ],
    "width": 1440,
    "height": 900,
    "directions": [
      "frost"
    ]
  },
{
  "path": "back-office/incidents.html",
  "title": "Office print incidents",
  "states": [
    [
      "default",
      "All three incident classes"
    ],
    [
      "kitchen-failed",
      "Kitchen work — FAILED"
    ],
    [
      "kitchen-unknown",
      "Kitchen work — UNKNOWN"
    ],
    [
      "cancel-failed",
      "Cancellation — FAILED"
    ],
    [
      "cancel-unknown",
      "Cancellation — UNKNOWN"
    ],
    [
      "receipt-failed",
      "Receipt — FAILED"
    ],
    [
      "receipt-unknown",
      "Receipt — UNKNOWN"
    ],
    [
      "empty",
      "Nothing outstanding"
    ],
    [
      "loading",
      "Reading incidents"
    ],
    [
      "error",
      "Read failed"
    ],
    [
      "overflow",
      "Many mixed incidents"
    ],
    [
      "kitchen-checked",
      "Kitchen acknowledgement checked"
    ],
    [
      "cancel-checked",
      "Cancellation acknowledgement checked"
    ],
    [
      "cleared-elsewhere",
      "Kitchen incident cleared on POS"
    ],
    [
      "kitchen-reprint-pending",
      "Kitchen ticket — Reprint pending"
    ],
    [
      "kitchen-reprint-sent",
      "Kitchen ticket — Reprint sent"
    ],
    [
      "kitchen-reprint-failed",
      "Kitchen ticket — Reprint failed again"
    ],
    [
      "kitchen-reprint-unknown",
      "Kitchen ticket — Reprint outcome unknown"
    ],
    [
      "kitchen-reprint-printed",
      "Kitchen ticket — Server confirms printed"
    ],
    [
      "cancel-reprint-pending",
      "Cancellation — Reprint pending"
    ],
    [
      "cancel-reprint-sent",
      "Cancellation — Reprint sent"
    ],
    [
      "cancel-reprint-failed",
      "Cancellation — Reprint failed again"
    ],
    [
      "cancel-reprint-unknown",
      "Cancellation — Reprint outcome unknown"
    ],
    [
      "cancel-reprint-printed",
      "Cancellation — Server confirms printed"
    ],
    [
      "receipt-reprint-pending",
      "Receipt — Reprint pending"
    ],
    [
      "receipt-reprint-sent",
      "Receipt — Reprint sent"
    ],
    [
      "receipt-reprint-failed",
      "Receipt — Reprint failed again"
    ],
    [
      "receipt-reprint-unknown",
      "Receipt — Reprint outcome unknown"
    ],
    [
      "receipt-reprint-printed",
      "Receipt — Server confirms printed"
    ],
    [
      "kitchen-reread-pending",
      "Kitchen ticket — Reread pending"
    ],
    [
      "kitchen-reread-unknown",
      "Kitchen ticket — Reread still UNKNOWN"
    ],
    [
      "kitchen-reread-failed",
      "Kitchen ticket — Reread confirms FAILED"
    ],
    [
      "kitchen-reread-error",
      "Kitchen ticket — Reread failed — Try again"
    ],
    [
      "cancel-reread-pending",
      "Cancellation — Reread pending"
    ],
    [
      "cancel-reread-unknown",
      "Cancellation — Reread still UNKNOWN"
    ],
    [
      "cancel-reread-failed",
      "Cancellation — Reread confirms FAILED"
    ],
    [
      "cancel-reread-error",
      "Cancellation — Reread failed — Try again"
    ],
    [
      "receipt-reread-pending",
      "Receipt — Reread pending"
    ],
    [
      "receipt-reread-unknown",
      "Receipt — Reread still UNKNOWN"
    ],
    [
      "receipt-reread-failed",
      "Receipt — Reread confirms FAILED"
    ],
    [
      "receipt-reread-error",
      "Receipt — Reread failed — Try again"
    ]
  ],
  "width": 1440,
  "height": 900,
  "directions": [
    "frost"
  ]
},
  {
    "path": "back-office/audit.html",
    "title": "Audit — actions and outcomes",
    "directions": ["frost"],
    "states": [['default','Audit entries'],['empty','No entries yet'],['nomatch','No matching entries'],['loading','Reading entries'],['error','Read failed'],['overflow','Long log — paging and sticky header'],['entry-refund','Refund — charged, refunded and net'],['entry-void','Whole-order void'],['entry-self','Self-approved void'],['entry-line','Fired-line void — distinct values'],['entry-line-second','Second fired-line void — own values'],['entry-apply','Discount applied'],['entry-replace','Discount replaced'],['entry-remove','Discount removed'],['entry-preset','Preset applied — no approval'],['entry-failed','Approval failed'],['entry-cancelled','Approval cancelled'],['entry-refused-refund','Approved refund refused'],['entry-refused-void','Approved void refused'],['entry-cooldown','Approval request refused by cooldown'],['entry-takeover','Checkout takeover'],['entry-kitchen','Kitchen work-ticket reprint'],['entry-cancellation','Cancellation-ticket reprint'],['entry-long','Long name and amount']],
    "width": 1440,
    "height": 900
  }
];

// The legacy gallery hard-codes six labels and assumes both directions exist.
// Keep its existing indices intact; the added floor is Frost-only.
if (typeof document !== 'undefined') {
  const requested = new URLSearchParams(location.search);
  if (['pos/floor.html','pos/closed-orders.html','pos/closed-order.html'].includes(requested.get('screen'))) {
    requested.set('direction', 'frost');
    history.replaceState(null, '', '?' + requested);
  }
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.screens');
    if (!nav) return;
    const floor = nav.children[MOCKUPS.findIndex(x => x.path === 'pos/floor.html')];
    const frost = document.querySelector('[data-direction="frost"]');
    const paper = document.querySelector('[data-direction="paper"]');
    floor.textContent = 'POS floor';
    ['pos/closed-orders.html','pos/closed-order.html'].forEach(path => {
      const item = nav.children[MOCKUPS.findIndex(x => x.path === path)];
      item.textContent = path.includes('closed-orders') ? 'Closed orders' : 'Closed detail';
      item.addEventListener('click', () => frost.click(), true);
      paper.addEventListener('click', () => { if (item.hasAttribute('aria-current')) nav.children[0].click(); }, true);
    });
    floor.addEventListener('click', () => frost.click(), true);
    paper.addEventListener('click', () => {
      if (floor.hasAttribute('aria-current')) nav.children[0].click();
    }, true);
  });
}

window.MOCKUPS.push({path:"back-office/login.html",title:"Login",directions:["frost"],width:1440,height:900,states:[['default','Resting'],['logged-out','After explicit logout'],['invalid-both','Blank form — both fields missing'],['invalid-username','Missing username'],['invalid-password','Missing password'],['oversize-username','Oversize username'],['oversize-password','Oversize password'],['oversize-both','Both fields oversized'],['loading','Signing in'],['error','Sign-in failed'],['throttled','Account cooldown'],['session-ended','Session ended — no draft'],['session-ended-draft','Session ended — isolated draft'],['forbidden','Manager access required'],['unavailable','System unavailable'],['unexpected','Something went wrong'],['lookup-unavailable','Initial lookup unavailable'],['lookup-unexpected','Initial lookup unexpected failure'],['overflow','Overflow — form scrolls']]});

window.MOCKUPS.push({path:"back-office/today.html",title:"Today",directions:["frost"],width:1440,height:900,states:[['default','Day open — orders outstanding'],['ready','Day open — no open orders'],['empty','No trading yet'],['loading','Reading Today'],['error','Read failed'],['overflow','Long open-order list'],['incident','Kitchen emergency and receipt warning'],['receipt','Receipt warning'],['phase0','Phase 0 — empty frame']]});

window.MOCKUPS.push({path:"back-office/tables.html",title:"Tables",directions:["frost"],width:1440,height:900,states:[['default','Active and inactive tables'],['empty','No tables — starting state'],['loading','Reading tables'],['load-error','Read failed'],['overflow','Long floor — 32-character label'],['create','New table'],['rename','Edit active table'],['rename-inactive','Edit inactive table'],['invalid-empty','Empty label'],['invalid-long','Label over 32 characters'],['invalid-control','Pasted control character'],['saving','Save pending'],['saved','Saved table'],['duplicate-create','Label in use — create refused'],['duplicate-rename','Label in use — rename refused'],['duplicate-reactivate','Label in use — reactivation refused'],['deactivated','Deactivated table retained'],['reactivated','Reactivated table'],['failure','General failure — draft kept'],['unknown','Outcome unknown — list reread'],['unknown-read-failed','Outcome unknown — reread unavailable'],['pending-deactivate','Deactivation pending'],['unknown-deactivate','Deactivation outcome unknown'],['pending-reactivate','Reactivation pending'],['unknown-reactivate','Reactivation outcome unknown'],['unsaved','Cancel — stay or discard'],['unsaved-escape','Escape — stay or discard'],['unsaved-back','Browser back — stay or discard'],['unsaved-rail','Tables entry — stay or discard'],['unsaved-logout','Log out — stay or discard'],['leave-pending','Leave while saving'],['leave-unknown','Leave after unknown outcome'],['reauth','M-6 over unsaved table'],['bo01-draft','BO-01 — isolated table draft'],['reauth-decision','M-6 over departure decision'],['bo01-decision','BO-01 — departure dialog closed'],['rejected-phase2','Phase 2 only — OPEN order refusal']]});

window.MOCKUPS.push({path:"back-office/settings.html",title:"Settings",directions:["frost"],width:1440,height:900,states:[['default','Version 4 in force'],['first-run','First run — nothing saved, every field empty'],['first-run-closed','First run — form closed'],['loading','Reading settings and methods'],['load-error','Settings read failed'],['longest','Longest stored values'],['edit','Edit — opened from Change tax rate'],['edit-service','Edit — opened from Change service charge rate'],['edit-longest','Edit — longest value in every field'],['invalid-rate-empty','Rate empty'],['invalid-rate-format','Rate not a number'],['invalid-rate-negative','Rate negative'],['invalid-rate-over','Rate over 100'],['invalid-rate-decimals','Rate with five decimal places'],['invalid-required','Required details empty'],['invalid-long','Every detail one character too long'],['invalid-address-lines','Address with a fourth line'],['invalid-control','Pasted control characters'],['invalid-phone','Phone with letters'],['confirm-rates','Rate change — confirmation'],['saving','Save pending'],['saved','Saved — version 5 in force'],['unchanged','Saved with nothing changed'],['stale','Settings changed — draft kept'],['stale-reauth','Settings changed — after M-6'],['stale-own-tab','Settings changed — saved by you in another tab'],['failure','General failure — draft kept'],['unknown','Outcome unknown — version unchanged'],['unknown-changed','Outcome unknown — newer version read'],['unknown-read-failed','Outcome unknown — reread unavailable'],['unsaved','Cancel — stay or discard'],['unsaved-escape','Escape — stay or discard'],['unsaved-back','Browser back — stay or discard'],['unsaved-rail','Rail entry — stay or discard'],['unsaved-logout','Log out — keep or discard'],['unsaved-switch','Open a payment method — stay or discard'],['leave-pending','Leave while saving'],['leave-unknown','Leave after unknown outcome'],['reauth','M-6 over unsaved settings'],['bo01-draft','BO-01 — settings draft held'],['reauth-confirm','M-6 over the rate confirmation'],['bo01-confirm','BO-01 — confirmation closed and held'],['methods-empty','No custom payment methods'],['methods-load-error','Payment methods read failed'],['methods-overflow','Long method list — 32-character name'],['method-create','New payment method'],['method-rename','Edit active method'],['method-rename-inactive','Edit inactive method'],['method-invalid-empty','Method name empty'],['method-invalid-long','Method name over 32 characters'],['method-invalid-control','Method name with control character'],['method-saving','Method save pending'],['method-saved','Method saved'],['method-duplicate-create','Name in use — create refused'],['method-duplicate-rename','Name in use — rename refused'],['method-duplicate-reactivate','Name in use — reactivation refused'],['method-deactivated','Method deactivated'],['method-reactivated','Method reactivated'],['method-pending-deactivate','Deactivation pending'],['method-unknown-deactivate','Deactivation outcome unknown'],['method-failure','Method general failure — draft kept'],['method-unknown','Method outcome unknown — list reread'],['method-partial','Saved while the list read stands failed'],['method-unsaved','Method Cancel — stay or discard'],['method-unsaved-switch','Change a setting — stay or discard']]});

window.MOCKUPS.push({path:"back-office/item-editor.html",title:"Item editor",directions:["frost"],width:1440,height:900,states:[
  [
    "default",
    "Editing an item"
  ],
  [
    "new",
    "New item in its category"
  ],
  [
    "loading",
    "Reading the item"
  ],
  [
    "load-error",
    "Item read failed"
  ],
  [
    "not-found",
    "Unknown subject"
  ],
  [
    "none",
    "No variants or modifiers"
  ],
  [
    "archived",
    "Editing an archived item"
  ],
  [
    "eightysix",
    "Editing an unavailable item"
  ],
  [
    "archived-eightysix",
    "Editing an archived, 86’d item"
  ],
  [
    "in-archived-category",
    "Item in an archived category"
  ],
  [
    "overflow",
    "Longest names and largest amounts"
  ],
  [
    "floor",
    "Negative variant floors at zero"
  ],
  [
    "saving",
    "One save pending"
  ],
  [
    "saved",
    "Saved item, ready to return"
  ],
  [
    "unchanged",
    "Nothing changed"
  ],
  [
    "duplicate-create",
    "New item name in use"
  ],
  [
    "duplicate-rename",
    "Renamed item name in use"
  ],
  [
    "duplicate-archived-category",
    "Name held in an archived category"
  ],
  [
    "failure",
    "Definite failure"
  ],
  [
    "unknown",
    "Outcome unknown, same version"
  ],
  [
    "unknown-changed",
    "Outcome unknown, newer version"
  ],
  [
    "unknown-read-failed",
    "Outcome unknown, reread failed"
  ],
  [
    "stale",
    "Catalog changed, draft kept"
  ],
  [
    "stale-same",
    "Catalog changed elsewhere, same item"
  ],
  [
    "stale-read-failed",
    "Catalog changed, reread failed"
  ],
  [
    "stale-removed",
    "Changed variant removed elsewhere"
  ],
  [
    "stale-duplicate",
    "Kept option conflicts with a current name"
  ],
  [
    "create-category-archived",
    "New item category archived meanwhile"
  ],
  [
    "move-category-archived",
    "Destination category archived meanwhile"
  ],
  [
    "remove-pending",
    "Saved option pending removal"
  ],
  [
    "remove-undone",
    "Removal undone"
  ],
  [
    "reorder",
    "Options reordered in draft"
  ],
  [
    "unsaved",
    "Departure decision"
  ],
  [
    "unsaved-logout",
    "Logout decision"
  ],
  [
    "leave-pending",
    "Departure while save pending"
  ],
  [
    "leave-unknown",
    "Departure with unknown outcome"
  ],
  [
    "reauth",
    "M-6 over an item draft"
  ],
  [
    "bo01-draft",
    "BO-01 with draft held"
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
    "invalid-item-empty",
    "Item name — empty"
  ],
  [
    "invalid-item-long",
    "Item name — long"
  ],
  [
    "invalid-item-control",
    "Item name — control"
  ],
  [
    "invalid-variant-empty",
    "Variant name — empty"
  ],
  [
    "invalid-variant-long",
    "Variant name — long"
  ],
  [
    "invalid-variant-control",
    "Variant name — control"
  ],
  [
    "invalid-variant-duplicate",
    "Variant name — duplicate"
  ],
  [
    "invalid-modifier-empty",
    "Modifier name — empty"
  ],
  [
    "invalid-modifier-long",
    "Modifier name — long"
  ],
  [
    "invalid-modifier-control",
    "Modifier name — control"
  ],
  [
    "invalid-modifier-duplicate",
    "Modifier name — duplicate"
  ],
  [
    "invalid-base-empty",
    "Base — empty"
  ],
  [
    "invalid-base-format",
    "Base — format"
  ],
  [
    "invalid-base-bounds",
    "Base — bounds"
  ],
  [
    "invalid-base-negative",
    "Base — negative"
  ],
  [
    "invalid-variant-delta-empty",
    "Variant-Delta — empty"
  ],
  [
    "invalid-variant-delta-format",
    "Variant-Delta — format"
  ],
  [
    "invalid-variant-delta-bounds",
    "Variant-Delta — bounds"
  ],
  [
    "invalid-modifier-delta-empty",
    "Modifier-Delta — empty"
  ],
  [
    "invalid-modifier-delta-format",
    "Modifier-Delta — format"
  ],
  [
    "invalid-modifier-delta-bounds",
    "Modifier-Delta — bounds"
  ],
  [
    "invalid-modifier-delta-negative",
    "Modifier-Delta — negative"
  ]
]});

// DESIGN-022 — BO-07, every state shared with the standalone artifact.
window.MOCKUPS.push({
  "path": "back-office/presets.html",
  "title": "Discount presets",
  "directions": [
    "frost"
  ],
  "width": 1440,
  "height": 900,
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
});
