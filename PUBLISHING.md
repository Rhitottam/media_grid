# 📦 Publishing Guide for CloudGrid

This guide explains how to publish CloudGrid packages to npm and deploy the demo to GitHub Pages.

## Prerequisites

- Node.js 18+
- npm 10+
- npm account with publish permissions
- GitHub account with repository access

## 🚀 Publishing to npm

### 1. Update Version

Update the version in `packages/cloudgrid/package.json`:

```bash
cd packages/cloudgrid
npm version patch  # or minor, or major
```

### 2. Build the Package

```bash
cd packages/cloudgrid
npm run build
```

Verify the build output in `dist/`:
- `index.js` (ESM)
- `index.cjs` (CommonJS)
- `index.d.ts` (TypeScript definitions)
- `cloudgrid.css` (Styles)
- Workers (`grid.worker.js`, `image-loader.worker.js`)

### 3. Test Locally

Before publishing, test the package locally:

```bash
# In packages/cloudgrid
npm pack

# This creates a .tgz file
# Install it in a test project:
cd /path/to/test-project
npm install /path/to/cloudgrid-cloudgrid-1.0.0.tgz
```

### 4. Publish to npm

```bash
cd packages/cloudgrid

# Login to npm (if not already)
npm login

# Publish
npm publish --access public
```

### 5. Verify Publication

Visit [https://www.npmjs.com/package/@convadraw/cloudgrid](https://www.npmjs.com/package/@convadraw/cloudgrid)

Install in a test project:
```bash
npm install @convadraw/cloudgrid
```

## 🌐 Deploying Demo to GitHub Pages

### Method 1: Automatic (GitHub Actions)

The demo automatically deploys when you push to the `main` branch.

1. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Source: "GitHub Actions"

2. **Push to main:**
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git push origin main
   ```

3. **Monitor deployment:**
   - Go to Actions tab in GitHub
   - Watch the "Deploy to GitHub Pages" workflow

4. **Access demo:**
   - Visit `https://yourusername.github.io/cloudgrid/`

### Method 2: Manual

```bash
# Build all packages
cd /Users/rhitottam/Documents/projects/cloud_grid
npm install

# Build WASM
cd packages/wasm
npm run build

# Build CloudGrid package
cd ../cloudgrid
npm run build

# Build demo
cd ../../apps/www
npm run build

# Deploy manually using gh-pages (if needed)
npm install -g gh-pages
gh-pages -d dist
```

## 📋 Pre-Publish Checklist

- [ ] All tests pass
- [ ] Documentation is up-to-date
- [ ] CHANGELOG.md is updated
- [ ] Version number is bumped
- [ ] LICENSE file is present
- [ ] README.md is comprehensive
- [ ] All TypeScript types are exported
- [ ] CSS is properly bundled
- [ ] Workers are included in bundle
- [ ] Demo app builds successfully
- [ ] No console.log statements in production code

## 🔄 Update Workflow

1. **Make changes** in source code
2. **Update CHANGELOG.md** with changes
3. **Bump version** in package.json
4. **Build package:** `npm run build`
5. **Test locally** using `npm pack`
6. **Commit changes:** `git commit -m "Release vX.X.X"`
7. **Create git tag:** `git tag vX.X.X`
8. **Push to GitHub:** `git push origin main --tags`
9. **Publish to npm:** `npm publish`
10. **Monitor GitHub Actions** for demo deployment

## 📦 Package Contents

The published package includes:

```
@convadraw/cloudgrid/
├── dist/
│   ├── index.js          # ESM bundle
│   ├── index.cjs         # CommonJS bundle
│   ├── index.d.ts        # TypeScript types (ESM)
│   ├── index.d.cts       # TypeScript types (CJS)
│   ├── cloudgrid.css     # Styles
│   ├── grid.worker.js    # Grid rendering worker
│   ├── image-loader.worker.js  # Image loading worker
│   └── *.map             # Source maps
├── README.md
└── package.json
```

## 🐛 Troubleshooting

### "WASM module not found"
- Ensure `packages/wasm` is built before `packages/cloudgrid`
- Check that `@cloudgrid/wasm` is in dependencies

### "CSS not found"
- Verify `build:css` script runs after `tsup`
- Check `dist/cloudgrid.css` exists

### "Workers not working"
- Ensure workers are specified in tsup.config.ts entry points
- Verify worker files are in dist/

### Demo not loading on GitHub Pages
- Check vite.config.ts has correct `base` path
- Verify GitHub Actions workflow completed successfully
- Check browser console for CORS or path errors

## 📞 Support

If you encounter issues:
- Check [GitHub Issues](https://github.com/yourusername/cloudgrid/issues)
- Read [npm documentation](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- Contact support@cloudgrid.dev

---

**Happy Publishing! 🎉**
