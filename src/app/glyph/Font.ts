/**
 * A basic interface to facilitate font selection in text drawing methods.
 * These fonts generally include 256 glyphs, comprised of columns integer values containing rows bits of information.
 * An "on" bit in the value represents an "on" bit in the display RAM (and thus, in normal display mode, a lit pixel).
 * The top of a glyph is the least significant bit of each column.
 */
export interface Font {
    /**
     * Get the name of the font's character set.
     *
     * @return {string} The font's character set name.
     */
    getName(): string

    /**
     * Get the number of columns in the font.
     *
     * @return {number} The font's column count.
     */
    getColumns(): number

    /**
     * Get the number of rows in the font.
     *
     * @return {number} The font's row count.
     */
    getRows(): number

    /**
     * Get the glyph data for the font.
     *
     * @return {Array} An array of ints representing the columns for each glyph.
     */
    getGlyphs(): number[]
}
