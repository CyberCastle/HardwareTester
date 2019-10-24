// Font structures for Adafruit_GFX Library (1.1 and later) compatibility.
// prettier-ignore
export interface GFXglyph {
    bitmapOffset: number  // Pointer into GFXfont->bitmap
    width: number         // Bitmap dimensions in pixels
    height: number        // Bitmap dimensions in pixels
    xAdvance: number      // Distance to advance cursor (x axis)
    xOffset: number       // X dist from cursor pos to UL corner
    yOffset: number       // Y dist from cursor pos to UL corner
}

// prettier-ignore
export interface GFXFont {
    name?: string        // Font Family
    size?: number        // Font Size
    isBold?: boolean     // Bold indicator
    isItalic?: boolean   // Italic indicator
    bitmap: Uint8Array   // Glyph bitmaps, concatenated
    glyph: GFXglyph[]    // Glyph array
    first: number        // ASCII extents (first char)
    last: number         // ASCII extents (last char)
    yAdvance: number     // Newline distance (y axis)
}
