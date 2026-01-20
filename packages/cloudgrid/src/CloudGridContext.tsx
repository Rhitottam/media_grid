import { Editor } from '@convadraw/editor'
import { createContext, useContext } from 'react'

/**
 * Context for accessing the CloudGrid editor instance
 */
export const CloudGridContext = createContext<Editor | null>(null)

/**
 * Hook to access the CloudGrid editor instance
 * Must be used within a CloudGrid component
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const editor = useCloudGrid()
 *   
 *   const handleAddImage = () => {
 *     editor.addItem({
 *       type: 'image',
 *       src: 'https://example.com/image.jpg',
 *       x: 0,
 *       y: 0,
 *       width: 400,
 *       height: 300,
 *       naturalWidth: 1920,
 *       naturalHeight: 1080,
 *     })
 *   }
 *   
 *   return <button onClick={handleAddImage}>Add Image</button>
 * }
 * ```
 */
export function useCloudGrid(): Editor {
  const editor = useContext(CloudGridContext)
  if (!editor) {
    throw new Error('useCloudGrid must be used within a CloudGrid component')
  }
  return editor
}

/**
 * Hook to optionally access the CloudGrid editor instance
 * Returns null if not within a CloudGrid component
 */
export function useCloudGridOptional(): Editor | null {
  return useContext(CloudGridContext)
}
