import { CloudGrid } from '@convadraw/cloudgrid'
import '@convadraw/cloudgrid/cloudgrid.css'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* Option 1: Use default components with simple props */}
      <CloudGrid
        gridSize={25}
        snapToGrid={true}
        showGrid={true}
        toolbarPosition="top-left"
        statsPanelPosition="top-right"
        onMount={(wasmInstance) => {
          console.log('CloudGrid mounted with WASM!', wasmInstance)
          console.log('Total objects:', wasmInstance.getObjectCount())
        }}
      />

      {/* Option 2: Use custom components via components prop
      <CloudGrid
        gridSize={25}
        components={{
          toolbar: <CompactToolbar position="top-left" />,
          statsPanel: <StatsPanel position="top-right" />
        }}
        onMount={(wasmInstance) => {
          console.log('CloudGrid mounted with WASM!', wasmInstance)
        }}
      />
      */}
    </div>
  )
}

export default App
