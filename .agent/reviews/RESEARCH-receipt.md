# Research: Indonesian F&B receipt content (PRD §9, question 1)

The owner asked the lead on 2026-10-08 to research the usual content of an Indonesian food
and beverage receipt and to propose it, one step at a time. This file collects the steps. It is
evidence for a proposal, not a decision: nothing here changes the PRD until the owner rules.

- **Step 1** — the fiscal and legal baseline. Done 2026-10-08.
- **Step 2** — what receipts carry in common practice in Jakarta. Done 2026-10-09.
- **Proposal** — the lead's proposed receipt, from steps 1 and 2, with the owner's choices. 2026-10-09.
- **Step 3** — refund documents, reprint markings, numbering. The research found no rule or settled
  practice, so these are owner choices inside the proposal, not a further search.

## Step 1: the fiscal and legal baseline

Source: the librarian (`.agent/bin/ask.sh librarian`, Codex, web search; Context7 had nothing
relevant), 2026-10-08. The lead checked the finding that matters most for the contract (Pergub
35/2024, Pasal 8 and 9) against Bapenda DKI's own explanation page. Everything else is the
librarian's reading of the linked sources and has not been checked by the lead.

### Findings

1. **The tax is PBJT, not PPN.** Restaurant food and drink is taxed as *PBJT atas Makanan dan/atau
   Minuman* under UU 1/2022 (HKPD) and PP 35/2023. "Pajak Restoran" or "PB1" is the label from
   the previous regime and is still common on receipts. The national ceiling is 10%; each region
   sets its actual rate by Perda. Sources: UU 1/2022 arts. 50 and 58
   (https://jdih.kemenkeu.go.id/download/770ecf1d-664b-48a1-88f4-8849b8ca7258/1TAHUN2022UU.pdf),
   PP 35/2023 (https://peraturan.bpk.go.id/Details/252130/pp-no-35-tahun-2023), DKI Perda 1/2024
   (https://peraturan.bpk.go.id/Details/279709/perda-prov-dki-jakarta-no-1-tahun-2024).
2. **PPN does not apply** to restaurant meals within the regional-tax category. It is not a
   blanket exemption for every food sale. Sources: PMK 70/PMK.03/2022, and DJP's explanation
   (https://www.pajak.go.id/id/artikel/jasa-boga-jasa-tidak-kena-ppn).
3. **No national receipt template was found.** The librarian could not confirm any national rule
   that prescribes the fields of a restaurant receipt, or that requires the business name,
   address, NPWPD or NPWP, or a sequential number on every receipt.
4. **DKI Jakarta, Pergub 35/2024 (checked by the lead):**
   - *Pasal 8:* "jika Wajib PBJT mengenakan service charge atau biaya serupa kepada Subjek PBJT,
     maka jumlah pembayaran yang dikenakan sudah termasuk dalam dasar pengenaan PBJT." **The
     service charge is part of the tax base.**
   - *Pasal 9:* if a registered PBJT taxpayer's sales bill does not state the tax collected, the
     payment received is treated as already including the tax. This fits the PRD's nett pricing.
   - It sets no format, numbering or content rule for the bill.
   Source: https://bapenda.jakarta.go.id/artikel/ketentuan-dasar-pengenaan-pbjt-pada-pergub-nomor-35-tahun-2024
5. **Bandung:** Perda 1/2024 is the current framework. The older Bandung restaurant-tax rules
   required serialized, sequential bills; whether that survives under the 2024 framework is
   unconfirmed. Sources: https://jdih.bandung.go.id/home/produk-hukum/peraturan-perundang-undangan-daerah/23484,
   https://jdih.bandung.go.id/media/1478.
6. **Online monitoring** (tapping boxes, e-tax devices, Bapenda reporting): DKI has rules for
   electronic transaction reporting (Pergub 98/2019, Pergub 92/2011). The librarian found no rule
   that every single-outlet restaurant must have a device or a specific POS integration, and no
   rule tying monitoring to receipt layout or numbering. Obligations seem to depend on Bapenda's
   implementation and the taxpayer. Unconfirmed either way.
7. **Retention:** tax books, records and supporting documents are kept for **10 years** (UU KUP,
   UU 28/2007 art. 28(11), https://www.pajak.go.id/id/undang-undang-nomor-28-tahun-2007). This
   covers the records, not necessarily every customer's paper receipt.
8. **Service charge on the receipt:** no DKI rule found requiring it as a separate line.

### What this means for the contract

- **Possible conflict with PRD §4.** PRD §4 says the service charge is **not taxed**, a choice
  the owner confirmed ("nett"). In DKI Jakarta, Pergub 35/2024 Pasal 8 puts any service charge
  inside the PBJT base. If the restaurant is in Jakarta (or a region with the same rule) and
  charges a service charge, the tax the POS derives and reports (`D × r / (1 + r)`, from the
  discounted subtotal only) is lower than the tax owed. The difference is the tax on the service
  charge. Whether this is a real conflict depends on the region and on whether a service charge
  is charged at all. The lead raises it to the owner; the PRD is unchanged.
- **The tax label** on the receipt should probably read "PBJT" (or "PB1", which customers still
  recognise). This is for step 2 to settle from practice.
- **Numbering, NPWPD and business details** have no confirmed legal requirement. They become a
  question of common practice and of the regional rule, both for step 2.
- **Retention:** a 10-year horizon for sales records and reports bears on the pre-production
  gate's backup and restore item, not on receipt layout.

### Answered by the owner (2026-10-09, DECISIONS.md)

1. **Region: DKI Jakarta.** Step 2 follows Jakarta's rules and Jakarta practice.
2. **No service charge for now, but the rate stays adjustable.** At rate 0 the conflict with PRD §4
   does not arise. It is latent, not resolved: before anyone sets a non-zero rate, the owner must
   rule on Pasal 8, and PRD §4 would need replacement wording the lead drafts and the owner approves.

## Step 2: common practice in Jakarta

Source: the librarian (`.agent/bin/ask.sh librarian`, Codex, web search; Context7 returned only
Moka's payment API), 2026-10-09. The practice sources are **POS vendors' documentation**, not a survey
of Jakarta restaurants. Not checked by the lead.

1. **Fields.** Vendor examples (Moka's receipt settings and cashier guide,
   https://help.mokapos.com/cara-mengatur-tampilan-struk-penjualan,
   https://help.mokapos.com/materi-8-menggunakan-aplikasi-moka) carry the outlet name and contact
   details, a receipt or bill number with date and time, the table or sales type, the cashier, the
   items with quantity and price, subtotal, discount, total, payment and change. Near-universal:
   outlet identity, a transaction identifier and time, the items, the total. Optional: address,
   phone, tax ID, table or order type, cashier, discount, tax breakdown, payment method, change,
   footer.
2. **Nett pricing on the receipt.** Pergub 35/2024 Pasal 9 means a separate tax line is not
   required; a receipt may carry a tax-included note or none. Labels such as "termasuk PB1 10%" are
   vendor practice, not prescribed wording (template example: https://sobatkasir.com/tools/generator-struk).
3. **Bapenda.** Pergub 35/2024 defines a sales bill as proof of payment and of tax collection, and
   requires no NPWPD, Bapenda logo, QR code or e-tax identifier on it. DKI's monthly PBJT reporting
   runs through Pajak Online (SPPD filing, https://bapenda.jakarta.go.id/berita/tata-cara-pelaporan-pbjt-makanan-dan-minuman-di-website-pajakonline);
   that is a monthly return, not a live link from the POS. A sequential-number rule was found only in
   another locality's regulation and does not apply to DKI.
4. **Reprints and refunds.** Vendors support reprinting and refunding; no required "COPY" marking
   and no settled refund-document practice was found.
5. **Language.** Indonesian is the natural default; bilingual is plausible for tourist-facing venues.
   Unconfirmed as a measured practice.

## Proposal (lead, 2026-10-09; nothing here is decided)

What follows fits PRD §4 (nett, tax derived for display), FR-G7 (reprint with identical figures),
ARCHITECTURE's immutable `Receipt` (receipt number, closed-order facts, tender summary, business
fields, render-policy version) and `SettingsVersion` (receipt business details). Indonesian labels.

**Content, top to bottom (80 mm and 58 mm):**

1. Outlet name; address; phone — from the settings version the order opened under.
2. NPWPD — an optional settings field, printed only when set. Not required in DKI.
3. Receipt number and the close time (WIB, `DD/MM/YYYY HH:MM`, 24-hour).
4. Order type: *Dine-in · Meja <name>* or *Take-away* (quick sale); cashier's display name.
5. Lines: quantity, item name, line total; variants and modifiers indented beneath; voided lines
   omitted.
6. *Subtotal*; *Diskon <preset name or "Manual">* as a negative amount when present; *Biaya layanan*
   only when the rate is non-zero (today it is 0); **Total**.
7. *Termasuk PBJT <rate>%: Rp <tax_included>* — the display-only figure PRD §4 already derives.
8. Payments: one line per tender with its amount; for cash, *Tunai* and *Kembalian*.
9. A footer line from settings (default *Terima kasih*).

**Owner choices (step 3):**

- **A. Receipt number.** Recommended: one plain sequence for the installation, allocated at close
  (`No. 000123`), never reused and never reset. Alternative: per business day (`20261009-0042`),
  easier to read aloud but it restarts daily. DKI sets no rule.
- **B. Reprint marking.** Recommended: a *SALINAN* (copy) line at the top of a reprint, with every
  figure identical (FR-G7). Alternative: no marking.
- **C. Refund document.** Recommended: a refund slip (*PENGEMBALIAN DANA*) naming the original
  receipt number, the amounts returned per tender, the manager who approved, and the time.
  Alternative: no slip; the refund lives only in the back office.
- **D. Language.** Recommended: Indonesian only. Alternative: Indonesian and English.
- **E. Tax label.** Recommended: *PBJT* (the current name). Alternative: *PB1*, which customers still
  recognise.

Settling these closes PRD §9 question 1 for the MVP; the lead then drafts the exact PRD wording for
the owner to approve.
