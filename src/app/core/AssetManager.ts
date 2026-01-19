export type AssetType = 'image' | 'video';

export interface Asset {
  id: number;
  type: AssetType;
  element: HTMLImageElement | HTMLVideoElement;
  url: string;
}

export class AssetManager {
  private assets: Map<number, Asset> = new Map();
  private nextAssetId = 1;

  async loadImage(url: string): Promise<number> {
    const img = new Image();
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });

    const assetId = this.nextAssetId++;
    this.assets.set(assetId, {
      id: assetId,
      type: 'image',
      element: img,
      url,
    });

    return assetId;
  }

  async loadVideo(url: string): Promise<number> {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.loop = true;

    await new Promise<void>((resolve) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.load();
    });

    const assetId = this.nextAssetId++;
    this.assets.set(assetId, {
      id: assetId,
      type: 'video',
      element: video,
      url,
    });

    return assetId;
  }

  getAsset(assetId: number): Asset | undefined {
    return this.assets.get(assetId);
  }

  getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }

  removeAsset(assetId: number): void {
    this.assets.delete(assetId);
  }
}
