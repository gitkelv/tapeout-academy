# TapeOut Academy

**Tape out your first chip.** A concept chip-design school for the TapeOut ecosystem: build logic from NAND gates, prove it with a truth table, then "tape it out" to burn transistor tokens and mint the circuit as an NFT. Every circuit you tape out becomes a reusable chip for the next lesson, climbing from NAND to a full adder running on a block clock.

> Community concept prototype. Not affiliated with TapeOut. Everything is simulated in the browser: no wallet, no chain, no real tokens.

## Lessons
1. NOT · 2. AND · 3. OR · 4. XOR · 5. Half adder · 6. Full adder → 4-bit counter on a 2.22 Hz block clock

## How it maps to TapeOut
| Prototype | TapeOut (as publicly described) |
|---|---|
| TRN wallet balance | Transistor tokens (ERC-1155) |
| Tape out: burn TRN, mint card | Tape-out consumes transistors, mints the circuit as an ERC-721 |
| Taped-out circuits as palette chips | Composable circuit NFTs |
| Block clock lesson | Processor clocked by block production |

## Where the team could take it
- Replace the simulated wallet with a real wallet on X Layer / BNB Chain and call the actual tape-out contract.
- Issue lesson completions as onchain credentials.
- Royalties to designers whose circuits are reused (the "Reused in" counter is the hook).
- Sequential lessons: latches, registers, then the CPU.

## Run it
Static site, no build step. Open `index.html`, or deploy the repo to Vercel as-is.

Code map: `app.js` (lessons, simulator, editor, tape-out, dot field), `style.css`, `logo.svg`.
