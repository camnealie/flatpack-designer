import { useState } from 'react';
import { useProject } from './hooks/useProject';
import { ItemList } from './components/ItemList';
import { ItemEditor } from './components/ItemEditor';
import { Configurator } from './components/Configurator';
import { ModelViewer } from './components/ModelViewer';
import { NestingPreview } from './components/NestingPreview';
import { PartsList } from './components/PartsList';
import { Section } from './components/ui/Section';
import { ExportSuccessModal } from './components/ExportSuccessModal';
import { AssemblyModal } from './components/AssemblyModal';
import { downloadAllSheetsZip, downloadCutList } from './lib/dxf/export';
import { money, describeDelivery } from './lib/pricing/suppliers';
import { shareUrl } from './lib/share/url';

const EXPORT_FILENAME = 'flatpack-dxf-files.zip';

/**
 * The console.
 *
 * Everything lives on one screen and the page itself never scrolls, because
 * the question this app answers is "if I change this, what happens?" - which
 * only works if the job, the ply and the money are all in view at the moment
 * you move a slider. The rails scroll; the two viewports never move.
 */
function App() {
  const [output, actions] = useProject();
  const [exported, setExported] = useState(false);
  const [showAssembly, setShowAssembly] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(output.project));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused outright. The address bar already
      // holds the design, so say that rather than failing silently.
      window.prompt('Copy this link', shareUrl(output.project));
    }
  };

  const sheetCount = output.nestingResult.sheets.length;
  const totalParts = output.partDefinitions.reduce(
    (sum, def) => sum + def.quantity,
    0
  );

  const handleExportDXF = async () => {
    if (sheetCount === 0) return;
    await downloadAllSheetsZip(output.nestingResult.sheets, 'flatpack');
    setExported(true);
  };

  const partsListProps = {
    project: output.project,
    partDefinitions: output.partDefinitions,
    hardware: output.hardware,
    advice: output.advice,
    manual: output.manual,
    supplier: output.supplier,
    material: output.material,
    price: output.price,
    cuts: output.cuts,
    sheets: sheetCount,
    onSelectItem: actions.selectItem,
    includeFreight: output.project.includeFreight,
    onIncludeFreight: actions.setIncludeFreight,
    onDownloadCutList: () =>
      downloadCutList(output.partDefinitions, 'flatpack-cut-list.csv'),
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1
        border-b border-rule bg-white px-3 py-1.5">
        <h1 className="text-[14px] font-semibold tracking-tight text-graphite">
          Flatpack Designer
        </h1>

        {/* The consequences of the last slider move, in one glance */}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px]">
          <Stat label="Items">{output.project.items.length}</Stat>
          <Stat label="Parts">{totalParts}</Stat>
          <Stat label="Sheets">{sheetCount}</Stat>
          <Stat label="Cuts">{output.cuts.cuts}</Stat>
          <Stat label="Waste">
            {output.nestingResult.totalWastePercentage.toFixed(1)}%
          </Stat>
          {/* A total on its own invites the wrong assumption about delivery,
              so it never appears without saying which way it goes. */}
          <Stat label="Est." note={describeDelivery(output.price)}>
            {money(output.price.total)}
          </Stat>
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          className="ml-auto rounded px-2 py-1 text-[12px] text-graphite/60
            hover:bg-console hover:text-graphite focus:outline-none
            focus-visible:ring-2 focus-visible:ring-signal"
        >
          {copied ? 'Link copied' : 'Copy link'}
        </button>

        {/* The animation is the app's explanation of itself, so it sits in the
            header next to the export rather than buried in a panel. */}
        <button
          type="button"
          onClick={() => setShowAssembly(true)}
          disabled={sheetCount === 0}
          className="rounded border border-signal/40 px-2.5 py-1 text-[12px]
            font-medium text-signal hover:bg-signal/10 disabled:border-rule
            disabled:text-graphite/30 focus:outline-none focus-visible:ring-2
            focus-visible:ring-signal"
        >
          How to build it
        </button>

        <button
          type="button"
          onClick={handleExportDXF}
          disabled={sheetCount === 0}
          className="rounded bg-signal px-2.5 py-1 text-[12px] font-medium
            text-white hover:bg-signal/90 disabled:bg-rule disabled:text-graphite/40
            focus:outline-none focus-visible:ring-2 focus-visible:ring-signal
            focus-visible:ring-offset-1"
        >
          Export DXF
        </button>
      </header>

      {/* Below a laptop there is no room for three columns side by side, so the
          console unstacks into a single scrolling column and the viewports take
          a fixed height rather than a share of one. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row
        lg:overflow-hidden">
        {/* Stacked, the controls sit below the viewports: scrolling past every
            slider to reach the thing they change would be the wrong way round. */}
        <aside className="rail-scroll order-2 w-full shrink-0 border-t border-rule
          bg-white lg:order-1 lg:w-[272px] lg:overflow-y-auto lg:border-t-0
          lg:border-r">
          <div className="mx-auto w-full max-w-2xl lg:max-w-none">
            <ItemList
              project={output.project}
              onSelect={actions.selectItem}
              onAdd={actions.addItem}
              onRemove={actions.removeItem}
            />

            {output.selected && (
              <ItemEditor
                key={output.selected.id}
                item={output.selected}
                thickness={output.material.thickness}
                supplier={output.supplier}
                advice={output.selectedAdvice}
                onUpgradeThickness={actions.setThickness}
                onChange={(patch) =>
                  actions.updateItem(output.selected!.id, patch)
                }
              />
            )}

            <Configurator
              project={output.project}
              supplier={output.supplier}
              material={output.material}
              actions={actions}
            />

            {/* On a narrower screen the reference rail is gone, so the cut list
                folds in here rather than becoming unreachable. */}
            <div className="xl:hidden">
              <Section title="Cut list and price" summary={money(output.price.total)}>
                <PartsList {...partsListProps} />
              </Section>
            </div>
          </div>
        </aside>

        {/* The two live views, stacked: a nested sheet row is far wider than it
            is tall, so it belongs in a band under the job rather than beside it,
            where it would be a sliver. */}
        <main className="order-1 flex min-w-0 flex-1 flex-col lg:order-2">
          <div className="flex h-[420px] shrink-0 flex-col border-b border-rule
            lg:h-auto lg:min-h-0 lg:flex-[6] lg:shrink">
            <ModelViewer
              assembly={output.assembly}
              material={output.material}
              selected={output.selected}
              thickness={output.material.thickness}
              onSelectItem={actions.selectItem}
              {...{
                // The selected item states its own problems in the editor, in
                // more detail and with the fix attached. Repeating them here
                // would be the same sentence twice on one screen, so this strip
                // covers the items you are not currently looking at.
                warnings: output.warnings.filter(
                  (w) => w.itemId !== output.project.selectedItemId
                ),
              }}
            />
          </div>
          <div className="flex h-[340px] shrink-0 flex-col lg:h-auto lg:min-h-0
            lg:flex-[5] lg:shrink">
            <NestingPreview
              nestingResult={output.nestingResult}
              sheetWidth={output.material.sheetWidth}
              sheetHeight={output.material.sheetHeight}
              cornerRadius={output.cornerRadius}
              selectedItemId={output.project.selectedItemId}
              onSelectItem={actions.selectItem}
            />
          </div>
        </main>

        {/* What comes out of it */}
        <aside className="rail-scroll order-3 hidden w-[256px] shrink-0
          overflow-y-auto border-l border-rule bg-white xl:block">
          <PartsList {...partsListProps} />
        </aside>
      </div>

      {showAssembly && (
        <AssemblyModal
          onClose={() => setShowAssembly(false)}
          assembly={output.assembly}
          sheets={output.nestingResult.sheets}
          items={output.project.items}
          supplier={output.supplier}
          material={output.material}
          holeCount={output.holeCount}
        />
      )}

      <ExportSuccessModal
        open={exported}
        filename={EXPORT_FILENAME}
        sheetCount={sheetCount}
        partCount={totalParts}
        onClose={() => setExported(false)}
      />
    </div>
  );
}

function Stat({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-graphite/40">{label}</span>
      <span className="font-medium tabular-nums text-graphite">{children}</span>
      {note && <span className="text-[10px] text-graphite/40">{note}</span>}
    </span>
  );
}

export default App;
