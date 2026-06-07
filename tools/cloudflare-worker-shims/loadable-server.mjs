const normalizeAsset = (asset) => {
  if (typeof asset === 'string') {
    return {
      filename: asset.replace(/^\//u, ''),
      path: asset,
      url: asset,
    };
  }

  if (!asset || typeof asset !== 'object') {
    return;
  }

  const source = asset.url || asset.publicPath || asset.name || asset.path;

  if (typeof source !== 'string') {
    return;
  }

  return {
    filename: asset.name || asset.filename || source.replace(/^\//u, ''),
    path: asset.path || source,
    url: source,
  };
};

const assetsForGroup = (stats, groupName) => {
  const group =
    stats?.namedChunkGroups?.[groupName] ||
    stats?.entrypoints?.[groupName] ||
    stats?.assetsByChunkName?.[groupName];

  const assets = Array.isArray(group) ? group : group?.assets || group?.children || [];

  return assets.map(normalizeAsset).filter(Boolean);
};

export class ChunkExtractor {
  constructor({ stats, entrypoints = [] } = {}) {
    this.stats = stats || {};
    this.entrypoints = entrypoints;
    this.chunks = [...entrypoints];
  }

  collectChunks(component) {
    void this.entrypoints;
    return component;
  }

  getChunkAssets(chunks = []) {
    return chunks.flatMap((chunkName) => assetsForGroup(this.stats, chunkName));
  }

  getScriptTags() {
    void this.chunks;
    return '';
  }
}
