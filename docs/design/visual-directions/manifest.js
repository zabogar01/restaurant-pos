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
        "Modal — cashier PIN refused"
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
      ["kitchen", "Kitchen emergency"],
      ["category-invalid", "Modal — category, empty name refused"],
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
    ],
    "width": 1440,
    "height": 900
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
      [
        "reauth-other",
        "Different manager refused"
      ],
      [
        "reauth-throttled",
        "LOGIN cooldown"
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
