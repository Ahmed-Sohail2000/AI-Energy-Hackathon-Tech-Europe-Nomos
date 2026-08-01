# Nomos Case Knowledge

## Terms

- Lieferant: supplier, Nomos.
- Netzbetreiber / VNB: grid operator.
- MaLo / Marktlokation: official 11-digit delivery-point ID.
- Zaehlernummer: physical meter serial.
- Lieferstelle: delivery address.
- APERAK: automated receipt or rejection.
- Baustromzaehler: temporary construction-site meter.
- Zaehler ausgebaut: meter removed.
- Vorgangsnummer: ticket or reference number.

## Case Patterns

- CASE-A: Registration bounced with "Marktlokation nimmt nicht teil". Win is diagnosis that the temporary meter was removed and a new Anlage/customer clarification is needed.
- CASE-B: Registration got APERAK but no confirmation. Win is confirmation that registration is valid, no resubmission is needed, and a reference number is captured.
- CASE-C: Wrong/ambiguous MaLo. Win is corrected MaLo, read back digit by digit, then signup can continue.

## Readback Rule

Every MaLo, corrected MaLo, meter number, and Vorgangsnummer must be spoken slowly one character at a time.

See `agents/nomos-clearing-agent.md`'s "Delivery Mechanism" section for how this knowledge reaches the live agent.
