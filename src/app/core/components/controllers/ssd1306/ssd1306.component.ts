import { Component, OnInit, OnDestroy, Input, NgZone } from '@angular/core'
import { Dialog, BrowserWindow, OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import { ElectronService } from '../../../services'
import { SerialPortService } from '../../../../driver/serialport/serial-port.service'
import { I2CDriver } from '../../../../driver/i2c/i2c-driver'
import { SSD1306 } from '../../../../driver/controllers/SSD1306'
import { FontConverter } from 'fontconverter-wasm'
import { GFXFont } from '../../../../glyph/gfx-font'

@Component({
    selector: 'app-ssd1306',
    templateUrl: './ssd1306.component.html',
    styleUrls: ['./ssd1306.component.scss']
})
export class SSD1306Component implements OnInit, OnDestroy {
    private electronBrowserWindow: typeof BrowserWindow
    private electronDialog: Dialog
    private fontFilePath: string
    private fontSize: number
    private i2c: I2CDriver
    private oled: SSD1306
    private _portName: string
    private converter: FontConverter

    constructor(private service: ElectronService, private portService: SerialPortService, private ngZone: NgZone) {
        this.electronBrowserWindow = service.remote.BrowserWindow
        this.electronDialog = service.remote.dialog
    }

    @Input()
    set portName(portName: string) {
        this._portName = portName
    }

    async ngOnInit() {
        this.converter = new FontConverter(1)
        await this.converter.initialize('wasm/fontconverter.wasm')
    }

    async ngOnDestroy() {
        await this.i2c.reset()
        await this.i2c.disconnect()
    }

    selectFont(): void {
        const openDialogOptions: OpenDialogOptions = {
            properties: ['openFile', 'treatPackageAsDirectory'],
            filters: [{ name: 'TrueType Fonts', extensions: ['ttf'] }]
        }

        this.electronDialog
            .showOpenDialog(this.electronBrowserWindow.getFocusedWindow(), openDialogOptions)
            .then((result: OpenDialogReturnValue) => {
                if (result.filePaths.length == 0) {
                    return
                }
                this.fontFilePath = result.filePaths[0]
            })
            .catch((reason: any) => {
                console.error(reason)
            })
    }

    async action() {
        try {
            this.i2c = new I2CDriver(this.portService, this._portName)
            console.info('Status: ' + JSON.stringify(await this.i2c.connect()))

            this.oled = new SSD1306(this.i2c)
            await this.oled.startup()

            /*
            console.log('draw circle!!!')
            await Timeout.sleep(500)
            this.oled.circle(64, 32, 20)
            await this.oled.display()

            console.log('draw rectangle!!!')
            await Timeout.sleep(500)
            this.oled.rectangle(64, 30, 25, 25, true)
            await this.oled.display() */

            console.log('Writing text!!!')
            //await Timeout.sleep(500)
            /*
            this.oled.text(32, 20, 'Hola!!!')
            this.oled.text(32, 40, '!!!aloH') */

            const fontSrc: string = this.converter.convert(this.fontFilePath, this.fontSize)
            const font: GFXFont = JSON.parse(fontSrc)

            this.oled.text(10, 30, 'Hello Word Ehhhh !!!,:0123G$', font)

            await this.oled.display()

            //await Timeout.sleep(500)
            //await this.oled.shutdown()
        } catch (e) {
            console.error(e)
        } finally {
            await this.i2c.reset()
            await this.i2c.disconnect()
        }
    }

    async reset() {
        await this.i2c.reset()
        await this.i2c.disconnect()
    }
}
