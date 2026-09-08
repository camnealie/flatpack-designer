# Flatpack Designer

Design a sheet-goods cabinet, see it standing up in 3D, then get the nested
cut layout and CNC-ready DXF files for it.

Built on the 32mm cabinet system: shelf pin holes on a 64mm ladder, 35mm
concealed hinge cups, mounting plates on the front 32mm column.

## What it does

A job is a list of things to make, all cut from one material. Add a cabinet,
add some shelves, add a couple of plain panels to use up what is left of the
sheet - each is configured on its own, and they all nest together because they
all come off the same order.

The whole app is one screen that never scrolls: the item list and its controls
on the left, the job and its ply stacked in the middle, the cut list and the
price on the right. Move a slider and the model, the nesting, the sheet count,
the cut count and the estimate all move together.

- **Backs are one decision.** Open, rails, a panel housed inside, or a panel
  laid over the back. Rails and a panel do the same job, so having both was
  paying twice; and an inset panel takes its thickness off every shelf behind
  it, which the cut list now reflects.
- **Items.** Cabinets (carcass, shelves, optional doors), loose shelves, and
  plain panels. Selecting one anywhere - the list, the 3D view, the sheet
  layout - highlights it in all three.
- **3D model** updates live. Panels are drawn the way the material is:
  laminate on the two faces, bare ply on every sawn edge, so you can see which
  edges will show and need finishing. Adjustable shelves snap to the pin rows
  that actually get bored.
- **Doors** are a checkbox. Hinges default to the sprung no-drill type that
  screws to the face, so nothing needs machining; switch to concealed 35mm and
  the cups and mounting-plate holes appear in the doors and side panels.
- **Nesting** packs everything onto 2440 x 1220 sheets with the saw's real 4mm
  kerf between parts, and a "pack tight" mode that leaves the drop as one
  usable panel rather than scattered strips.
- **Price** estimated per supplier from real paperwork, always labelled with
  the invoice it came from and its date. The running total never appears
  without saying whether shipping is in it, and shipping is Auckland only -
  where a supplier has never quoted one, the estimate says so rather than
  quietly reading as free.
- **How to build it** opens a full-screen guide, one step at a time: sand the
  edges, soften the ones that will show, drill the holes (or check the ones the
  CNC bored), then this panel to that one with these screws, until it stands
  up. The two prep steps demonstrate on a single board rather than the whole
  job, with the round-over shown as the actual profile the edge becomes. Panels lift off the sheet as you go and the screws for each joint appear
  where they belong. The panel that leaves the sheet is the rectangle the
  machine actually cuts, holes and all - nothing is drawn twice.
- **Shareable links.** The whole design lives in the URL, so copying the
  address bar is how you show someone what you are making. No account, no
  server, nothing to save.
- **Gaps you can picture.** Every opening between shelves is measured and
  named for what will go in it - "a cereal box", "a wine bottle standing up",
  "a tin of beans" - so adding one shelf too many is visible before it is
  ordered rather than after.
- **Focus on what changed.** Add or remove anything and the rest of the piece
  drops back for a moment, so a shelf appearing behind a closed door is
  actually something you can see happen. Shelves redistribute evenly whenever
  the count changes and slide to their new heights rather than jumping.
- **Sag advice.** Tell it what the shelves will hold and it works the actual
  midspan deflection and says it in millimetres. Where a thicker sheet would
  fix it, switching is one button. This is the guard against saving money on a
  thinner sheet and getting a shelf with a smile in it.
- **Fixings** names the screw and both drill sizes, because screwing into the
  edge of plywood is where assembly goes wrong and it goes wrong when nobody
  says what to pre-drill.
- **Export** a ZIP of per-sheet DXF files (layers: `CUT`, `DRILL_5MM`,
  `DRILL_35MM`, `POCKET`, `LABEL`) plus a CSV cut list.

## Suppliers

Two, and they are not interchangeable. Picking one changes the price, the gap
between nested parts, and how much work lands on your bench.

| | Plyman Henderson | PPR Penrose |
|---|---|---|
| Cutting | Panel saw, to size | Full CNC |
| Holes in the DXF | A drawing for you to work from | Machined for you |
| Charged | $40 set-up + $4 a cut | $180 a sheet |
| Kerf | 4mm blade | 10mm cutter |
| Inside corners | Square | 5mm radius, measured from their cut files |
| Delivery | $95 by their truck, Auckland only | Not quoted; collected from Penrose |
| Priced from | Quotation S19801, 24 Aug 2026 | Invoice 16388, 22 Aug 2022 |

Because Plyman charge per cut, the layout's cut count is worth deriving rather
than guessing - see `src/lib/pricing/cuts.ts`. PPR charge a flat rate per
sheet, so the same count is shown but does not move the price.

Neither finishes edges. The ply core shows on every cut edge, only the faces
are laminated, and sanding and rounding over are yours either way. The app
lists what is left to you rather than letting the DXF imply otherwise.

Everything lives in `src/lib/pricing/suppliers.ts`, transcribed from the two
invoices plus each supplier's listed prices. It is a snapshot; every figure
carries its source and the UI dates the estimate. **The supplier paperwork
itself is gitignored** - it carries addresses, bank accounts and GST numbers,
which have no business in a repo that might go public.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks, then builds to dist/
npm run lint
```

## Deploying

The app is entirely static - no server, no API, no build-time secrets - so
GitHub Pages hosts it as-is.

`.github/workflows/deploy.yml` builds on every push to `main` and publishes
`dist` straight to Pages. Before the first run, set **Settings → Pages →
Source** to **GitHub Actions**.

The one thing a project site needs is the right base path: Pages serves it from
`/<repo>/`, not the domain root, so `vite.config.ts` reads `GITHUB_REPOSITORY`
(which Actions sets) and bakes in the prefix. Locally it is unset and the app
builds for the root, so the same config covers both.

## Layout

```
src/lib/project/     The job: items, defaults, advice, build plan
src/lib/share/       The design, encoded into a link
src/lib/geometry/    Flat parts: panels, shelves, doors, hinge boring
src/lib/model3d/     The same items as furniture, and the sheet-to-unit move
src/lib/engineering/ Will it sag, what fits in it, what holds it together
src/lib/nesting/     Sheet packing and offcut analysis
src/lib/pricing/     Suppliers, charges, and the cut-count estimate
src/lib/dxf/         DXF writer and export
```

`geometry/` and `model3d/` are two views of one configuration, and they share
their sources of truth (`shelfPinRows`, `planHinges`) so the cut file and the
3D model cannot drift apart. `model3d/choreography.ts` is what joins them: it
matches each nested rectangle to the panel it becomes, which is how the guide
can move one mesh from the sheet into the assembly and put the holes on it.

`share/url.ts` is a storage format, not a convenience. It carries a version,
writes items as positional arrays so a link stays short enough to look like a
link, and treats everything it decodes as untrusted - a link from an older
build should open, not crash.

Adding another kind of item means a case in `generateItemParts` and one in
`buildItem`; nothing downstream needs to change.
