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
      ["open-t9", "Table 9 — 5 items fired"],
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
      ]
    ],
    "width": 1280,
    "height": 800
  }
];

// The legacy gallery hard-codes six labels and assumes both directions exist.
// Keep its existing indices intact; the added floor is Frost-only.
if (typeof document !== 'undefined') {
  const requested = new URLSearchParams(location.search);
  if (requested.get('screen') === 'pos/floor.html') {
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
    floor.addEventListener('click', () => frost.click(), true);
    paper.addEventListener('click', () => {
      if (floor.hasAttribute('aria-current')) nav.children[0].click();
    }, true);
  });
}
