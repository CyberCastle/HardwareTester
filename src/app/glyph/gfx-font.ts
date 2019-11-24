// Font structures for Adafruit_GFX Library (1.1 and later) compatibility.

// prettier-ignore
export interface GFXFont {
    name: string         // Font Family
    size: number         // Font Size
    style: string        // Font Style
    bitmap: Uint8Array   // Glyph bitmaps, concatenated
    glyph: Uint8Array[]  // Glyph array
    bits: number         // Printable bits (7 or 8)
    firstChar: number    // ASCII extents (first char)
    lastChar: number     // ASCII extents (last char)
    yAdvance: number     // Newline distance (y axis)
}

/*
glyph array struct:
    Element 0: (bitmapOffset) Pointer into GFXfont->bitmap
    Element 1: (width)        Bitmap dimensions in pixels
    Element 2: (height)       Bitmap dimensions in pixels
    Element 3: (xAdvance)     Distance to advance cursor (x axis)
    Element 4: (xOffset)      X dist from cursor pos to UL corner
    Element 5: (yOffset)      Y dist from cursor pos to UL corner
*/
