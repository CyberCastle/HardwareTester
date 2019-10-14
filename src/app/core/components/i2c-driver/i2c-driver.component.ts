import { Component, OnInit, OnDestroy, Input } from '@angular/core'
import { SerialPortService } from '../../../driver/serialport/serial-port.service'
import { I2CDriver } from '../../../driver/i2c/i2c-driver'

@Component({
    selector: 'app-i2c-driver',
    templateUrl: './i2c-driver.component.html',
    styleUrls: ['./i2c-driver.component.scss'],
})
export class I2cDriverComponent implements OnInit, OnDestroy {
    private i2c: I2CDriver
    private i2cStatus: I2CDriver.Status = null
    private _isConnected: boolean
    private _portName: string
    private i2cAddress: number[]
    private i2cAddressMask: number[][]

    constructor(private serialPortService: SerialPortService) {
        this.i2cAddress = []
    }

    get isConnected() {
        return this._isConnected
    }

    @Input()
    set portName(portName: string) {
        this._portName = portName
    }

    ngOnInit() {
        this.initI2cAddressMask()
    }

    async ngOnDestroy() {
        if (this._isConnected) {
            await this.i2c.disconnect()
        }
    }

    connectDevice() {
        if (this._isConnected) {
            return
        }
        this.i2c = new I2CDriver(this.serialPortService, this._portName)
        this.i2c.connect(true).then(i2cStatus => {
            this.i2cStatus = i2cStatus
            this._isConnected = true
        })
    }

    getDeviceStatus() {
        this.i2c.getStatus().then(i2cStatus => {
            this.i2cStatus = i2cStatus
        })
    }

    scanI2cAddress() {
        if (!this._isConnected) {
            return
        }
        this.i2c.scan().then(i2cAddress => {
            this.i2cAddress = i2cAddress
            this.initI2cAddressMask()
        })
    }

    async disconnectDevice() {
        if (!this._isConnected) {
            return
        }

        this.i2c.disconnect().then(() => {
            this._isConnected = false
            this.i2cAddress = []
            this.initI2cAddressMask()
            this.i2cStatus = null
        })
    }

    private initI2cAddressMask() {
        let row: number = 0
        this.i2cAddressMask = []
        this.i2cAddressMask[row] = []
        for (let i2cAddress = 8; i2cAddress <= 119; i2cAddress++) {
            this.i2cAddressMask[row].push(i2cAddress)

            if (i2cAddress % 8 == 7 && i2cAddress < 112) {
                row++
                this.i2cAddressMask[row] = []
            }
        }
    }

    async testPort() {
        this.serialPortService.serialPort
            .list()
            .then((ports: any) => {
                console.log(ports)
            })
            .catch((err: any) => {
                console.log(err)
            })

        this.i2c = new I2CDriver(this.serialPortService, '/dev/tty.usbserial-DO01JV8Z')
        console.log('Status: ' + JSON.stringify(await this.i2c.connect()))
        /*await this.i2c.i2cSpeed(400)
        console.log('Status: ' + JSON.stringify(await this.i2c.getStatus()))

        await this.i2c.i2cSpeed(100)
        console.log('Status: ' + JSON.stringify(await this.i2c.getStatus()))

        await this.i2c.setPullups(0b110111)
        console.log('Status: ' + JSON.stringify(await this.i2c.getStatus()))
        await this.i2c.setPullups(0b100100)
        console.log('Status: ' + JSON.stringify(await this.i2c.getStatus()))

        console.log(await this.i2c.scan(true))
        await this.i2c.i2cRestore()
        await this.i2c.reset()
        console.log(await this.i2c.scan())*/

        await this.i2c.disconnect()
    }
}
