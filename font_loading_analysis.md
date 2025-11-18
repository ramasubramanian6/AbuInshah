# Font Loading Issues Investigation Report

## Issues Identified

### 1. **Incorrect Font Path in CSS**
**Problem**: The client CSS file (`client/src/index.css`) uses a relative path `../assets/fonts/NotoSans-VariableFont_wdth,wght.ttf` which doesn't resolve correctly in production.

**Current CSS:**
```css
@font-face {
  font-family: 'Noto Sans';
  src: url('../assets/fonts/NotoSans-VariableFont_wdth,wght.ttf') format('truetype-variations');
  font-weight: 1 1000;
  font-stretch: 62.5% 100%;
}
```

**Issue**: The relative path `../assets/` goes up one level from `src/` to `client/`, then looks for `assets/fonts/`, but the font files are in `client/assets/fonts/`.

### 2. **Font File Hashing in Production**
**Problem**: Vite automatically hashes font files in production for cache busting, changing `NotoSans-VariableFont_wdth,wght.ttf` to `NotoSans-VariableFont_wdth_wght-CYoOFcCZ.ttf`.

**Evidence**: The built CSS shows:
```css
@font-face {
  font-family: Noto Sans;
  src: url(/assets/NotoSans-VariableFont_wdth_wght-CYoOFcCZ.ttf) format("truetype-variations");
  font-weight: 1 1000;
  font-stretch: 62.5% 100%
}
```

### 3. **Missing MIME Type Configuration**
**Problem**: The Express server doesn't explicitly serve fonts with correct MIME types, potentially causing browsers to reject the font files.

### 4. **Path Resolution in Production**
**Problem**: The server serves static files from `../client/dist` but doesn't handle font paths correctly relative to the domain root.

## Root Causes

1. **Development vs Production Path Mismatch**: The relative path works in development (Vite dev server) but fails in production (static file serving).

2. **Font File Hashing**: Vite's production build changes font filenames, but the original CSS still references the unhashed version.

3. **MIME Type Issues**: Font files may be served with incorrect MIME types, causing browser rejection.

## Production Issues

When deployed to production:
- Fonts appear as small boxes because browsers can't load the font files
- The relative path `../assets/fonts/` doesn't resolve correctly from the served CSS location
- Missing or incorrect MIME types prevent font file loading
- CORS headers might block font loading if served from a different domain

## Recommended Solutions

### Solution 1: Fix CSS Path (Primary Fix)
**File**: `client/src/index.css`

**Change from:**
```css
src: url('../assets/fonts/NotoSans-VariableFont_wdth,wght.ttf') format('truetype-variations');
```

**Change to:**
```css
src: url('/assets/fonts/NotoSans-VariableFont_wdth,wght.ttf') format('truetype-variations');
```

**Explanation**: Use absolute path from domain root, which Vite will correctly process and hash in production.

### Solution 2: Add MIME Type Support to Server
**File**: `server/server.js`

**Add after existing static file middleware:**
```javascript
// Serve fonts with correct MIME types
app.use('/assets/fonts', express.static(path.join(__dirname, '../client/dist/assets/fonts'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.ttf')) {
      res.setHeader('Content-Type', 'font/ttf');
    } else if (path.endsWith('.woff')) {
      res.setHeader('Content-Type', 'font/woff');
    } else if (path.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2');
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
  }
}));
```

### Solution 3: Alternative - Use Google Fonts (Fallback)
If local font serving continues to fail, consider using Google Fonts CDN:

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@100..1000&display=swap');
```

### Solution 4: Vite Configuration Enhancement
**File**: `client/vite.config.ts`

Add explicit font handling:
```javascript
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.ttf', '**/*.woff', '**/*.woff2'],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.match(/\.(ttf|woff|woff2)$/)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  }
});
```

## Implementation Priority

1. **High Priority**: Fix the CSS path (Solution 1) - This should resolve 90% of the issue
2. **Medium Priority**: Add MIME type support (Solution 2) - Prevents future font loading issues
3. **Low Priority**: Consider Google Fonts fallback (Solution 3) - Only if local fonts continue to fail

## Testing Steps

After implementing fixes:

1. **Development Test**: Run `npm run dev` and verify fonts load correctly
2. **Production Build Test**: Run `npm run build` and test the built version
3. **Network Tab Check**: Open browser DevTools Network tab and verify:
   - Font files load with 200 status codes
   - MIME types are correct (`font/ttf` for .ttf files)
   - No CORS errors in console
4. **Cross-browser Test**: Test in Chrome, Firefox, Safari, and Edge

## Expected Results

After implementing the fixes:
- ✅ Fonts should display as proper text instead of small boxes
- ✅ Font loading should work in both development and production
- ✅ Improved caching with proper cache headers
- ✅ Better error handling and debugging