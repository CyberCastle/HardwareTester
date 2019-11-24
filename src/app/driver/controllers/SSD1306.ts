import { I2CDriver } from './../i2c/i2c-driver'
import { GFXFont } from '../../glyph/gfx-font'
import { DefaultFont } from '../../glyph/fonts/default-font'

/**
 * This code is based primarily on the work of fauxpark (https://github.com/fauxpark/oled-core),
 * with addition of codes obtained from https://github.com/entrusc/Pi-OLED,
 * https://github.com/noopkat/oled-js and https://github.com/adafruit/Adafruit-GFX-Library/blob/master/Adafruit_GFX.cpp
 * (for custom font support)
 *
 *  Datashhet can be obtained from here http://www.adafruit.com/datasheets/SSD1306.pdf
 *
 */

export class SSD1306 {
    /**
     * Default values
     */
    public readonly DEFAULT_DISPLAY_ADDRESS: number = 0x3c
    public readonly DEFAULT_DISPLAY_WIDTH: number = 128
    public readonly DEFAULT_DISPLAY_HEIGHT: number = 64

    /**
     * I2C address of the display.
     */
    public _displayAddress: number = null

    /**
     * The width of the display in pixels.
     */
    private width: number

    /**
     * The height of the display in pixels.
     */
    private height: number

    /**
     * The number of pages in the display.
     */
    private pages: number

    /**
     * The display buffer.
     */
    private frameBuffer: Uint8Array

    /**
     * The lower column start address for page addressing mode.
     */
    private lowerColStart: number

    /**
     * The higher column start address for page addressing mode.
     */
    private higherColStart: number

    /**
     * The memory addressing mode of the display.
     */
    private memoryMode: number

    /**
     * Indicates whether the display is currently scrolling.
     */
    private scrolling: boolean

    /**
     * The starting row of the display buffer.
     */
    private startLine: number

    /**
     * The current contrast level of the display.
     */
    private contrast: number

    /**
     * Indicates whether the display is horizontally flipped.
     */
    private hFlipped: boolean

    /**
     * Indicates whether the display is inverted.
     */
    private inverted: boolean

    /**
     * Indicates whether the display is on or off.
     */
    private displayOn: boolean

    /**
     * The starting page of the display for page addressing mode.
     */
    private startPage: number

    /**
     * Indicates whether the display is vertically flipped.
     */
    private vFlipped: boolean

    /**
     * The current display offset.
     */
    private offset: number

    /**
     * The hardware configuration of the display's COM pins.
     */
    private comPins: number

    public constructor(private i2c: I2CDriver, displayAddress?: number, width?: number, height?: number) {
        if (!displayAddress) {
            this._displayAddress = this.DEFAULT_DISPLAY_ADDRESS
        }

        if (!width) {
            this.width = this.DEFAULT_DISPLAY_WIDTH
        }

        if (!height) {
            this.height = this.DEFAULT_DISPLAY_HEIGHT
        }

        this.pages = this.height / 8
        this.frameBuffer = new Uint8Array(this.width * this.pages)
        this.frameBuffer.fill(0x00)
    }

    set displayAddress(displayAddress: number) {
        this._displayAddress = displayAddress
    }

    /* SSD1306 expects the Control byte in front of every Command (1-3 byte sequence) or sequence of Data bytes.
     *
     * Sources of information, among many more:
     *  https://lastminuteengineers.com/datasheets/SSD1306-128x64-OLED-Driver-Controller-Datasheet.pdf
     *  http://robotcantalk.blogspot.com/2015/03/interfacing-arduino-with-ssd1306-driven.html
     *  https://iotexpert.com/2019/08/07/debugging-ssd1306-display-problems/
     *  https://electronics.stackexchange.com/questions/411116/not-understanding-ssd1306-oled-display-datasheet/411141
     *
     * [ Co | D/C# | 0 | 0 | 0 | 0 | 0 | 0 ]
     * Co is a continuation bit. If set to 1, the controller expects another control byte in this I2C write cycle.
     *   If set to 0, the controller will not expect to receive another control byte in this I2C write cycle.
     *
     * 0x00 (Co = 0, D/C = 0): Next byte(s) are command (non-graphics) data, after which I2C stop condition is expected.
     * 0x80 (Co = 1, D/C = 0): Next byte(s) are command (non-graphics) data, after which another control byte is expected.
     * 0x40 (Co = 0, D/C = 1): Next byte(s) are graphs data, after which I2C stop condition is expected.
     * 0xC0 (Co = 1, D/C = 1): Multiple data or illegal combination?
     *
     * However, it is important that the last Control byte does not have Co bit set as the controller does not
     * reset internal command processor on end of the transfer. If the Co bit of the last command is set, the
     * command processor would then recognize the next received data byte as a Control byte.
     */

    // Method for send a command to SSD1306
    private async sendCommand(cmd: SSD1306.Command, params?: number[]): Promise<boolean> {
        let cmdConsolidated: Uint8Array
        if (params) {
            cmdConsolidated = new Uint8Array(params.length + 1)
            cmdConsolidated[0] = cmd
            cmdConsolidated.set(params, 1)
        } else {
            cmdConsolidated = new Uint8Array([cmd])
        }

        // 0x00 (Co = 0, D/C = 0): Next byte(s) are command (non-graphics) data.
        return this.i2c.i2cRegWrite(this._displayAddress, 0x00, cmdConsolidated)
    }

    // Method for send data to SSD1306
    private async sendData(data: Uint8Array): Promise<boolean> {
        if (data) {
            // 0x40 (Co = 0, D/C = 1): Next byte(s) are graphs data.
            return this.i2c.i2cRegWrite(this._displayAddress, 0x40, data)
        }
    }

    /**
     * Start the power on procedure for the display.
     */
    public async startup(externalVcc: boolean = false): Promise<void> {
        try {
            await this.setDisplayOn(false)
            await this.sendCommand(SSD1306.Command.SET_DISPLAY_CLOCK_DIV, [this.width])
            await this.sendCommand(SSD1306.Command.SET_MULTIPLEX_RATIO, [this.height - 1])
            await this.setOffset(0)
            await this.setStartLine(0)

            await this.sendCommand(
                SSD1306.Command.SET_CHARGE_PUMP,
                externalVcc ? [SSD1306.Constant.CHARGE_PUMP_DISABLE] : [SSD1306.Constant.CHARGE_PUMP_ENABLE]
            )
            await this.setMemoryMode(SSD1306.Constant.MEMORY_MODE_HORIZONTAL)
            await this.setHFlipped(false)
            await this.setVFlipped(false)
            await this.setCOMPinsConfiguration(
                this.height === 64 ? SSD1306.Constant.COM_PINS_ALTERNATING : SSD1306.Constant.COM_PINS_SEQUENTIAL
            )
            await this.setContrast(externalVcc ? 0x9f : 0xcf)
            await this.sendCommand(SSD1306.Command.SET_PRECHARGE_PERIOD, externalVcc ? [0x22] : [0xf1])
            await this.sendCommand(SSD1306.Command.SET_VCOMH_DESELECT, [SSD1306.Constant.VCOMH_DESELECT_LEVEL_00])
            await this.sendCommand(SSD1306.Command.DISPLAY_ALL_ON_RESUME)
            await this.setInverted(false)
            await this.setDisplayOn(true)
            await this.clearDisplay()
        } catch (ex) {
            console.error('SSD1306.startup(): there was an error on startup the device: ', ex)
            return Promise.reject(ex)
        }
    }

    /**
     * Start the power off procedure for the display.
     */
    public async shutdown(): Promise<void> {
        try {
            await this.clearDisplay()
            await this.setDisplayOn(false)
            await this.setInverted(false)
            await this.setHFlipped(false)
            await this.setVFlipped(false)
            await this.stopScroll()
            await this.setContrast(0)
            await this.setOffset(0)
        } catch (ex) {
            console.error('SSD1306.shutdown(): there was an error on shutdown the device: ', ex)
            return Promise.reject(ex)
        }
    }

    /**
     * Clear the Display.
     */
    public async clearDisplay(): Promise<void> {
        this.frameBuffer.fill(0x00)
        await this.display()
    }

    /**
     * Clear the buffer.
     */
    public clear() {
        this.frameBuffer.fill(0x00)
    }

    /**
     * Send the buffer to the display.
     */
    public async display(): Promise<void> {
        await this.sendCommand(SSD1306.Command.SET_COLUMN_ADDRESS, [0, this.width - 1])
        await this.sendCommand(SSD1306.Command.SET_PAGE_ADDRESS, [0, this.pages - 1])
        await this.sendData(this.frameBuffer)
        if (this.isScrolling()) {
            await this.noOp()
        }
    }

    /**
     * Get the lower column start address for page addressing mode.
     *
     * @return {number} The lower column start address, from 0 to 15.
     */
    public getLowerColStart(): number {
        return this.lowerColStart
    }

    /**
     * Set the lower column start address for page addressing mode.
     *
     * @param {number} lowerColStart The lower column start address, from 0 to 15. Values outside this range will be clamped.
     */
    public async setLowerColStart(lowerColStart: number): Promise<void> {
        lowerColStart = this.clamp(0, 15, lowerColStart)
        this.lowerColStart = lowerColStart
        await this.sendCommand(SSD1306.Command.SET_LOWER_COL_START | lowerColStart)
    }

    /**
     * Get the higher column start address for page addressing mode.
     *
     * @return {number} The higher column start address, from 0 to 15.
     */
    public getHigherColStart(): number {
        return this.higherColStart
    }

    /**
     * Set the higher column start address for page addressing mode.
     *
     * @param {number} higherColStart The higher column start address, from 0 to 15. Values outside this range will be clamped.
     */
    public async etHigherColStart(higherColStart: number): Promise<void> {
        higherColStart = this.clamp(0, 15, higherColStart)
        this.higherColStart = higherColStart
        await this.sendCommand(SSD1306.Command.SET_HIGHER_COL_START | higherColStart)
    }

    /**
     * Get the memory addressing mode.
     *
     * @return {number} The current memory mode, either Constant.MEMORY_MODE_HORIZONTAL, Constant.MEMORY_MODE_VERTICAL, or Constant.MEMORY_MODE_PAGE.
     */
    public getMemoryMode(): number {
        return this.memoryMode
    }

    /**
     * Set the memory addressing mode.
     *
     * @param {number} memoryMode The memory mode to set. Must be one of Constant.MEMORY_MODE_HORIZONTAL, Constant.MEMORY_MODE_VERTICAL, or Constant.MEMORY_MODE_PAGE.
     */
    public async setMemoryMode(memoryMode: number): Promise<void> {
        if (
            memoryMode === SSD1306.Constant.MEMORY_MODE_HORIZONTAL ||
            memoryMode === SSD1306.Constant.MEMORY_MODE_VERTICAL ||
            memoryMode === SSD1306.Constant.MEMORY_MODE_PAGE
        ) {
            this.memoryMode = memoryMode
            await this.sendCommand(SSD1306.Command.SET_MEMORY_MODE, [memoryMode])
        }
    }

    /**
     * Get the scrolling state of the display.
     *
     * @return {boolean} Whether the display is scrolling.
     */
    public isScrolling(): boolean {
        return this.scrolling
    }

    /**
     * Scroll the display horizontally.
     *
     * @param {boolean} direction The direction to scroll, where a value of true results in the display scrolling to the left.
     * @param {number} start The start page address, from 0 to 7.
     * @param {number} end The end page address, from 0 to 7.
     * @param {number} speed The scrolling speed (scroll step).
     */
    public async scrollHorizontally(direction: boolean, start: number, end: number, speed: number): Promise<void> {
        await this.sendCommand(direction ? SSD1306.Command.LEFT_HORIZONTAL_SCROLL : SSD1306.Command.RIGHT_HORIZONTAL_SCROLL, [
            SSD1306.Constant.DUMMY_BYTE_00,
            start,
            speed,
            end,
            SSD1306.Constant.DUMMY_BYTE_00,
            SSD1306.Constant.DUMMY_BYTE_FF
        ])
    }

    /**
     * Scroll the display horizontally and vertically.
     *
     * @param {boolean} direction The direction to scroll, where a value of true results in the display scrolling to the left.
     * @param {number} start The start page address, from 0 to 7.
     * @param {number} end The end page address, from 0 to 7.
     * @param {number} offset The number of rows from the top to start the vertical scroll area at.
     * @param {number} rows The number of rows in the vertical scroll area.
     * @param {number} speed The scrolling speed (scroll step).
     * @param {number} step The number of rows to scroll vertically each frame.
     */
    public async scrollDiagonally(
        direction: boolean,
        start: number,
        end: number,
        offset: number,
        rows: number,
        speed: number,
        step: number
    ): Promise<void> {
        await this.sendCommand(SSD1306.Command.SET_VERTICAL_SCROLL_AREA, [offset, rows])
        await this.sendCommand(
            direction ? SSD1306.Command.VERTICAL_AND_LEFT_HORIZONTAL_SCROLL : SSD1306.Command.VERTICAL_AND_RIGHT_HORIZONTAL_SCROLL,
            [SSD1306.Constant.DUMMY_BYTE_00, start, speed, end, step]
        )
    }

    /**
     * Stop scrolling the display.
     */
    public async stopScroll(): Promise<void> {
        this.scrolling = false
        await this.sendCommand(SSD1306.Command.DEACTIVATE_SCROLL)
    }

    /**
     * Start scrolling the display.
     */
    public async startScroll(): Promise<void> {
        this.scrolling = true
        await this.sendCommand(SSD1306.Command.ACTIVATE_SCROLL)
    }

    /**
     * Get the display start line.
     *
     * @return {number} The row to begin displaying at.
     */
    public getStartLine(): number {
        return this.startLine
    }

    /**
     * Set the display start line.
     *
     * @param {number} startLine The row to begin displaying at.
     */
    public async setStartLine(startLine: number): Promise<void> {
        startLine = this.clamp(0, this.height - 1, startLine)
        this.startLine = startLine
        await this.sendCommand(SSD1306.Command.SET_START_LINE | startLine)
    }

    /**
     * Get the display contrast.
     *
     * @return {number} The current contrast level of the display.
     */
    public getContrast(): number {
        return this.contrast
    }

    /**
     * Set the display contrast.
     *
     * @param {number} contrast The contrast to set, from 0 to 255. Values outside of this range will be clamped.
     */
    public async setContrast(contrast: number): Promise<void> {
        contrast = this.clamp(0, 255, contrast)
        this.contrast = contrast
        await this.sendCommand(SSD1306.Command.SET_CONTRAST, [contrast])
    }

    /**
     * Get the horizontal flip state of the display.
     *
     * @return {boolean} Whether the display is horizontally flipped.
     */
    public isHFlipped(): boolean {
        return this.hFlipped
    }

    /**
     * Flip the display horizontally.
     *
     * @param {boolean} hFlipped Whether to flip the display or return to normal.
     */
    public async setHFlipped(hFlipped: boolean): Promise<void> {
        if (hFlipped) {
            await this.sendCommand(SSD1306.Command.SET_SEGMENT_REMAP)
        } else {
            await this.sendCommand(SSD1306.Command.SET_SEGMENT_REMAP_REVERSE)
        }
        await this.display()
    }

    /**
     * Get the inverted state of the display.
     *
     * @return {boolean} Whether the display is inverted or not.
     */
    public isInverted(): boolean {
        return this.inverted
    }

    /**
     * Invert the display.
     * When inverted, an "on" bit in the buffer results in an unlit pixel.
     *
     * @param {boolean} inverted Whether to invert the display or return to normal.
     */
    public async setInverted(inverted: boolean): Promise<void> {
        this.inverted = inverted
        await this.sendCommand(inverted ? SSD1306.Command.INVERT_DISPLAY : SSD1306.Command.NORMAL_DISPLAY)
    }

    /**
     * Get the display state.
     *
     * @return {boolean} True if the display is on.
     */
    public isDisplayOn(): boolean {
        return this.displayOn
    }

    /**
     * Turn the display on or off.
     *
     * @param {boolean} displayOn Whether to turn the display on.
     */
    public async setDisplayOn(displayOn: boolean): Promise<void> {
        this.displayOn = displayOn
        if (displayOn) {
            await this.sendCommand(SSD1306.Command.DISPLAY_ON)
        } else {
            await this.sendCommand(SSD1306.Command.DISPLAY_OFF)
        }
    }

    /**
     * Get the starting page for page addressing mode.
     *
     * @return {number} The page to begin displaying at, from 0 to 7.
     */
    public getStartPage(): number {
        return this.startPage
    }

    /**
     * Set the starting page for page addressing mode.
     *
     * @param {number} startPage The page to begin displaying at, from 0 to 7. Values outside this range will be clamped.
     */
    public async setStartPage(startPage: number): Promise<void> {
        startPage = this.clamp(0, 7, startPage)
        this.startPage = startPage
        await this.sendCommand(SSD1306.Command.SET_PAGE_START_ADDR | startPage)
    }

    /**
     * Get the vertical flip state of the display.
     *
     * @return {boolean} Whether the display is vertically flipped.
     */
    public isVFlipped(): boolean {
        return this.vFlipped
    }

    /**
     * Flip the display vertically.
     *
     * @param {boolean} vFlipped Whether to flip the display or return to normal.
     */
    public async setVFlipped(vFlipped: boolean): Promise<void> {
        this.vFlipped = vFlipped
        if (vFlipped) {
            await this.sendCommand(SSD1306.Command.SET_COM_SCAN_INC)
        } else {
            await this.sendCommand(SSD1306.Command.SET_COM_SCAN_DEC)
        }
    }

    /**
     * Get the display offset.
     *
     * @return {number} The number of rows the display is offset by.
     */
    public getOffset(): number {
        return this.offset
    }

    /**
     * Set the display offset.
     *
     * @param {number} offset The number of rows to offset the display by. Values outside of this range will be clamped.
     */
    public async setOffset(offset: number): Promise<void> {
        offset = this.clamp(0, this.height - 1, offset)
        this.offset = offset
        await this.sendCommand(SSD1306.Command.SET_DISPLAY_OFFSET, [offset])
    }

    /**
     * Get hardware configuration of the display's COM pins.
     *
     * @return {number} The COM pins configuration, one of Constant.COM_PINS_SEQUENTIAL, Constant.COM_PINS_SEQUENTIAL_LR, Constant.COM_PINS_ALTERNATING or Constant.COM_PINS_ALTERNATING_LR.
     */
    public getCOMPinsConfiguration(): number {
        return this.comPins
    }

    /**
     * Set the hardware configuration of the display's COM pins.
     *
     * @param {number} comPins The COM pins configuration. Must be one of Constant.COM_PINS_SEQUENTIAL, Constant.COM_PINS_SEQUENTIAL_LR, Constant.COM_PINS_ALTERNATING or Constant.COM_PINS_ALTERNATING_LR.
     */
    public async setCOMPinsConfiguration(comPins: number): Promise<void> {
        if (
            comPins === SSD1306.Constant.COM_PINS_SEQUENTIAL ||
            comPins === SSD1306.Constant.COM_PINS_SEQUENTIAL_LR ||
            comPins === SSD1306.Constant.COM_PINS_ALTERNATING ||
            comPins === SSD1306.Constant.COM_PINS_ALTERNATING_LR
        ) {
            this.comPins = comPins
            await this.sendCommand(SSD1306.Command.SET_COM_PINS, [comPins])
        }
    }

    /**
     * No operation.
     */
    public async noOp(): Promise<void> {
        await this.sendCommand(SSD1306.Command.NOOP)
    }

    /**
     * Get a pixel in the buffer.
     *
     * @param {number} x The X position of the pixel to set.
     * @param {number} y The Y position of the pixel to set.
     *
     * @return {boolean} False if the pixel is "off" or the given coordinates are out of bounds, true if the pixel is "on".
     */
    public getPixel(x: number, y: number): boolean {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false
        }
        return (this.frameBuffer[x + ((y / 8) | 0) * this.width] & (1 << (y & 7))) !== 0
    }

    /**
     * Set a pixel in the buffer.
     *
     * @param {number} x The X position of the pixel to set.
     * @param {number} y The Y position of the pixel to set.
     * @param {boolean} on Whether to turn this pixel on or off.
     *
     * @return {boolean} False if the given coordinates are out of bounds.
     */
    public setPixel(x: number, y: number, on: boolean): boolean {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false
        }
        if (on) {
            this.frameBuffer[x + ((y / 8) | 0) * this.width] |= 1 << (y & 7)
        } else {
            this.frameBuffer[x + ((y / 8) | 0) * this.width] &= ~(1 << (y & 7))
        }

        return true
    }

    /**
     * Get the display buffer.
     *
     * @return {Array} The display buffer.
     */
    public getBuffer(): Uint8Array {
        return this.frameBuffer
    }

    /**
     * Set the display buffer.
     *
     * @param {Array} buffer The buffer to set.
     */
    public setBuffer(buffer: Uint8Array) {
        this.frameBuffer = buffer
    }

    /**
     * Clamp the given value to a specified range.
     *
     * @param {number} min The minimum value.
     * @param {number} max The maximum value.
     * @param {number} value The value to clamp.
     *
     * @return {number} The value clamped to the minimum and maximum values.
     * @private
     */
    clamp(min: number, max: number, value: number): number {
        if (value < min) {
            return min
        } else if (value > max) {
            return max
        }
        return value
    }

    /**
     * Draw text onto the display.
     *
     * @param {number} x The X position to start drawing at.
     * @param {number} y The Y position to start drawing at.
     * @param {string} text The text to draw.
     * @param {GFXFont} font The font to use. If this parameter is not set, a default font will be used.
     */
    public text(x: number, y: number, text: string, gfxFont?: GFXFont) {
        const chars: number[] = text.split('').map(s => s.charCodeAt(0))

        if (!gfxFont) {
            // Text is rendered with default font
            for (let i: number = 0; i < text.length; i++) {
                {
                    let p: number = (chars[i] & 255) * DefaultFont.COLUMNS
                    for (let col: number = 0; col < DefaultFont.COLUMNS; col++) {
                        {
                            let mask: number = DefaultFont.GLYPHS[p++]
                            for (let row: number = 0; row < DefaultFont.ROWS; row++) {
                                {
                                    this.setPixel(x, y + row, (mask & 1) === 1)
                                    mask >>= 1
                                }
                            }
                            x++
                        }
                    }
                    x++
                }
            }
        } else {
            // Text is rendered with custom font
            for (let i: number = 0; i < text.length; i++) {
                let c = chars[i]
                const first: number = gfxFont.firstChar
                const bitmap: Uint8Array = gfxFont.bitmap

                if (c >= first && c <= gfxFont.lastChar) {
                    c -= gfxFont.firstChar

                    /*
                    glyph array struct:
                        Element 0: (bitmapOffset) Pointer into GFXfont->bitmap
                        Element 1: (width)        Bitmap dimensions in pixels
                        Element 2: (height)       Bitmap dimensions in pixels
                        Element 3: (xAdvance)     Distance to advance cursor (x axis)
                        Element 4: (xOffset)      X dist from cursor pos to UL corner
                        Element 5: (yOffset)      Y dist from cursor pos to UL corner
                    */
                    const glyph: Uint8Array = gfxFont.glyph[c]
                    let bo: number = glyph[0]
                    const w: number = glyph[1]
                    const h: number = glyph[2]
                    const xa: number = glyph[3]
                    const xo: number = glyph[4]
                    const yo: number = glyph[5]

                    if (w > 0 && h > 0) {
                        // Is there an associated bitmap?
                        if (x + xo + w > this.width) {
                            x = 0
                            y += gfxFont.yAdvance
                        }
                        let xx = 0,
                            yy = 0,
                            bits = 0,
                            bit = 0

                        for (yy = 0; yy < h; yy++) {
                            for (xx = 0; xx < w; xx++) {
                                if (!(bit++ & 7)) {
                                    bits = bitmap[bo++]
                                }
                                if (bits & 0x80) {
                                    this.setPixel(x + xo + xx, y + yo + yy, true)
                                }
                                bits <<= 1
                            }
                        }
                    }
                    x += xa
                }
            }
        }
    }

    /**
     * Draw an image onto the display.
     *
     * @param {Array} image The image to draw.
     * @param {number} x The X position of the image.
     * @param {number} y The Y position of the image.
     * @param {number} width The width to resize the image to.
     * @param {number} height The height to resize the image to.
     */
    public image(image: number[], x: number, y: number, width: number, height: number) {}

    /**
     * Draw a line from one point to another (Bresenham's algorithm).
     *
     * @param {number} x0 The X position of the first point.
     * @param {number} y0 The Y position of the first point.
     * @param {number} x1 The X position of the second point.
     * @param {number} y1 The Y position of the second point.
     */
    public line(x0: number, y0: number, x1: number, y1: number) {
        let dx: number = x1 - x0
        let dy: number = y1 - y0
        if (dx === 0 && dy === 0) {
            this.setPixel(x0, y0, true)
            return
        }
        if (dx === 0) {
            for (let y: number = Math.min(y0, y1); y <= Math.max(y1, y0); y++) {
                {
                    this.setPixel(x0, y, true)
                }
            }
        } else if (dy === 0) {
            for (let x: number = Math.min(x0, x1); x <= Math.max(x1, x0); x++) {
                {
                    this.setPixel(x, y0, true)
                }
            }
        } else if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx < 0) {
                let ox: number = x0
                let oy: number = y0
                x0 = x1
                y0 = y1
                x1 = ox
                y1 = oy
                dx = x1 - x0
                dy = y1 - y0
            }
            let coeff: number = <number>dy / <number>dx
            for (let x: number = 0; x <= dx; x++) {
                {
                    this.setPixel(x + x0, y0 + ((<number>Math.round(x * coeff)) | 0), true)
                }
            }
        } else if (Math.abs(dx) < Math.abs(dy)) {
            if (dy < 0) {
                let ox: number = x0
                let oy: number = y0
                x0 = x1
                y0 = y1
                x1 = ox
                y1 = oy
                dx = x1 - x0
                dy = y1 - y0
            }
            let coeff: number = <number>dx / <number>dy
            for (let y: number = 0; y <= dy; y++) {
                {
                    this.setPixel(x0 + ((<number>Math.round(y * coeff)) | 0), y + y0, true)
                }
            }
        }
    }

    /**
     * Draw a rectangle.
     *
     * @param {number} x The X position of the rectangle.
     * @param {number} y The Y position of the rectangle.
     * @param {number} width The width of the rectangle in pixels.
     * @param {number} height The height of the rectangle in pixels.
     * @param {boolean} fill Whether to draw a filled rectangle.
     */
    public rectangle(x: number, y: number, width: number, height: number, fill: boolean) {
        if (fill) {
            for (let i: number = 0; i < width; i++) {
                {
                    for (let j: number = 0; j < height; j++) {
                        {
                            this.setPixel(x + i, y + j, true)
                        }
                    }
                }
            }
        } else if (width > 0 && height > 0) {
            this.line(x, y, x, y + height - 1)
            this.line(x, y + height - 1, x + width - 1, y + height - 1)
            this.line(x + width - 1, y + height - 1, x + width - 1, y)
            this.line(x + width - 1, y, x, y)
        }
    }

    /**
     * Draw an arc.
     *
     * @param {number} x The X position of the center of the arc.
     * @param {number} y The Y position of the center of the arc.
     * @param {number} radius The radius of the arc in pixels.
     * @param {number} startAngle The starting angle of the arc in degrees.
     * @param {number} endAngle The ending angle of the arc in degrees.
     */
    public arc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
        for (let i: number = startAngle; i <= endAngle; i++) {
            {
                this.setPixel(
                    x + ((<number>Math.round(radius * Math.sin(/* toRadians */ (x => (x * Math.PI) / 180)(i)))) | 0),
                    y + ((<number>Math.round(radius * Math.cos(/* toRadians */ (x => (x * Math.PI) / 180)(i)))) | 0),
                    true
                )
            }
        }
    }

    /**
     * Draw a circle.
     * This is the same as calling arc() with a start and end angle of 0 and 360 respectively.
     *
     * @param {number} x The X position of the center of the circle.
     * @param {number} y The Y position of the center of the circle.
     * @param {number} radius The radius of the circle in pixels.
     */
    public circle(x: number, y: number, radius: number) {
        this.arc(x, y, radius, 0, 360)
    }
}

export declare namespace SSD1306 {
    /**
     * This enum defines the commands that can be sent to the SSD1306.
     * Some of them are standalone commands and others require arguments following them.
     */
    const enum Command {
        /**
         * Set the lower column start address for page addressing mode.
         * OR this command with 0x00 to 0x0F (0 to 15) to set the desired value.
         */
        SET_LOWER_COL_START = 0x00,

        /**
         * Set the higher column start address for page addressing mode.
         * OR this command with 0x00 to 0x0F (0 to 15) to set the desired value.
         */
        SET_HIGHER_COL_START = 0x10,

        /**
         * Set the memory addressing mode.
         */
        SET_MEMORY_MODE = 0x20,

        /**
         * Set the column start and end address of the display.
         */
        SET_COLUMN_ADDRESS = 0x21,

        /**
         * Set the page start and end address of the display.
         */
        SET_PAGE_ADDRESS = 0x22,

        /**
         * Set the display to scroll to the right.
         */
        RIGHT_HORIZONTAL_SCROLL = 0x26,

        /**
         * Set the display to scroll to the left.
         */
        LEFT_HORIZONTAL_SCROLL = 0x27,

        /**
         * Set the display to scroll vertically and to the right.
         */
        VERTICAL_AND_RIGHT_HORIZONTAL_SCROLL = 0x29,

        /**
         * Set the display to scroll vertically and to the left.
         */
        VERTICAL_AND_LEFT_HORIZONTAL_SCROLL = 0x2a,

        /**
         * Turn off scrolling of the display.
         */
        DEACTIVATE_SCROLL = 0x2e,

        /**
         * Turn on scrolling of the display.
         */
        ACTIVATE_SCROLL = 0x2f,

        /**
         * Set the starting row of the display buffer.
         * OR this command with 0x00 to 0x3F (0 to 63) to set the desired value.
         */
        SET_START_LINE = 0x40,

        /**
         * Set the contrast of the display.
         */
        SET_CONTRAST = 0x81,

        /**
         * Sets the charge pump regulator state.
         */
        SET_CHARGE_PUMP = 0x8d,

        /**
         * Map column address 0 to SEG0.
         * This command is used for horizontally flipping the display.
         */
        SET_SEGMENT_REMAP = 0xa0,

        /**
         * Map column address 127 to SEG0.
         * This command is used for horizontally flipping the display.
         */
        SET_SEGMENT_REMAP_REVERSE = 0xa1,

        /**
         * Set the offset and number of rows in the vertical scrolling area.
         */
        SET_VERTICAL_SCROLL_AREA = 0xa3,

        /**
         * Turn on the display with the buffer contents.
         */
        DISPLAY_ALL_ON_RESUME = 0xa4,

        /**
         * Turn on the entire display, ignoring the buffer contents.
         */
        DISPLAY_ALL_ON = 0xa5,

        /**
         * Set the display to normal mode, where a 1 in the buffer represents a lit pixel.
         */
        NORMAL_DISPLAY = 0xa6,

        /**
         * Set the display to inverse mode, where a 1 in the buffer represents an unlit pixel.
         */
        INVERT_DISPLAY = 0xa7,

        /**
         * Set the multiplex ratio of the display.
         */
        SET_MULTIPLEX_RATIO = 0xa8,

        /**
         * Turn the display off (sleep mode).
         */
        DISPLAY_OFF = 0xae,

        /**
         * Turn the display on.
         */
        DISPLAY_ON = 0xaf,

        /**
         * Set the page start address for page addressing mode.
         * OR this command with 0x00 to 0x07 (0 to 7) to set the desired value.
         */
        SET_PAGE_START_ADDR = 0xb0,

        /**
         * Set the row output scan direction from COM0 to COM63.
         * This command is used for vertically flipping the display.
         */
        SET_COM_SCAN_INC = 0xc0,

        /**
         * Set the row output scan direction from COM63 to COM0.
         * This command is used for vertically flipping the display.
         */
        SET_COM_SCAN_DEC = 0xc8,

        /**
         * Set the display offset.
         * Maps the display start line to the specified row.
         */
        SET_DISPLAY_OFFSET = 0xd3,

        /**
         * Set the display clock divide ratio and oscillator frequency.
         * The divide ratio makes up the lower four bits.
         */
        SET_DISPLAY_CLOCK_DIV = 0xd5,

        /**
         * Set the duration of the pre-charge period.
         */
        SET_PRECHARGE_PERIOD = 0xd9,

        /**
         * Set the hardware configuration of the display's COM pins.
         */
        SET_COM_PINS = 0xda,

        /**
         * Adjust the V_COMH regulator output.
         */
        SET_VCOMH_DESELECT = 0xdb,

        /**
         * No operation.
         */
        NOOP = 0xe3
    }

    /**
     * This enum defines some useful constants, such as memory addressing modes, scrolling speeds and dummy bytes.
     */
    const enum Constant {
        /**
         * A dummy byte consisting of all zeroes.
         */
        DUMMY_BYTE_00 = 0x00,

        /**
         * A dummy byte consisting of all ones.
         */
        DUMMY_BYTE_FF = 0xff,

        /**
         * Horizontal memory addressing mode.
         * In this mode, after reading/writing the display RAM, the column address pointer is incremented.
         * When the pointer reaches the end, it is reset to the start address on the next page.
         */
        MEMORY_MODE_HORIZONTAL = 0x00,

        /**
         * Vertical memory addressing mode.
         * In this mode, after reading/writing the display RAM, the page address pointer is incremented.
         * When the pointer reaches the end, it is reset to the start address on the next column.
         */
        MEMORY_MODE_VERTICAL = 0x01,

        /**
         * Page memory addressing mode.
         * In this mode, after reading/writing the display RAM, the column address pointer is incremented.
         * When the pointer reaches the end, it is reset to the start address on the same page.
         */
        MEMORY_MODE_PAGE = 0x02,

        /**
         * Disable the charge pump regulator.
         */
        CHARGE_PUMP_DISABLE = 0x10,

        /**
         * Enable the charge pump regulator.
         */
        CHARGE_PUMP_ENABLE = 0x14,

        /**
         * Sequential COM pin hardware configuration.
         * With SD1306.Command.SET_COM_SCAN_INC issued, rows 0 - 63 on the display correspond to COM0 - COM63.
         */
        COM_PINS_SEQUENTIAL = 0x02,

        /**
         * Sequential COM pin hardware configuration with left/right remap.
         * With SD1306.Command.SET_COM_SCAN_INC issued, rows 0 - 31 on the display correspond to COM32 - COM63, and rows 32 - 63 correspond to COM0 - COM31.
         */
        COM_PINS_SEQUENTIAL_LR = 0x22,

        /**
         * Alternating COM pin hardware configuration.
         * With SD1306.Command.SET_COM_SCAN_INC issued, row 0 on the display corresponds to COM0, row 1 to COM32, row 2 to COM2, row 3 to COM33, etc.
         */
        COM_PINS_ALTERNATING = 0x12,

        /**
         * Alternating COM pin hardware configuration with left/right remap.
         * With SD1306.Command.SET_COM_SCAN_INC issued, row 0 on the display corresponds to COM32, row 1 to COM0, row 2 to COM33, row 3 to COM1, etc.
         */
        COM_PINS_ALTERNATING_LR = 0x32,

        /**
         * A VCOMH deselect level of ~0.65 &times, <code>V<sub>CC</sub></code>.
         */
        VCOMH_DESELECT_LEVEL_00 = 0x00,

        /**
         * A VCOMH deselect level of ~0.77 &times, <code>V<sub>CC</sub></code>.
         */
        VCOMH_DESELECT_LEVEL_20 = 0x20,

        /**
         * A VCOMH deselect level of ~0.83 &times, <code>V<sub>CC</sub></code>.
         */
        VCOMH_DESELECT_LEVEL_30 = 0x30,

        /**
         * Scroll by one pixel every 5 frames.
         */
        SCROLL_STEP_5 = 0x00,

        /**
         * Scroll by one pixel every 64 frames.
         */
        SCROLL_STEP_64 = 0x01,

        /**
         * Scroll by one pixel every 128 frames.
         */
        SCROLL_STEP_128 = 0x02,

        /**
         * Scroll by one pixel every 256 frames.
         */
        SCROLL_STEP_256 = 0x03,

        /**
         * Scroll by one pixel every 3 frames.
         */
        SCROLL_STEP_3 = 0x04,

        /**
         * Scroll by one pixel every 4 frames.
         */
        SCROLL_STEP_4 = 0x05,

        /**
         * Scroll by one pixel every 25 frames.
         */
        SCROLL_STEP_25 = 0x06,

        /**
         * Scroll by one pixel every 2 frames.
         */
        SCROLL_STEP_2 = 0x07
    }
}
