# Research: Indonesian F&B receipt content (PRD §9, question 1)

The owner asked the lead on 2026-10-08 to research the usual content of an Indonesian food
and beverage receipt and to propose it, one step at a time. This file collects the steps. It is
evidence for a proposal, not a decision: nothing here changes the PRD until the owner rules.

- **Step 1** — the fiscal and legal baseline (this section). Done 2026-10-08.
- **Step 2** — what receipts carry in common practice, narrowed to the owner's region. Not started.
- **Step 3** — refund documents, reprint markings, numbering, retention in the system. Not started.

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
