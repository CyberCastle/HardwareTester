import { Component, OnInit, OnDestroy, Input } from '@angular/core'
import { MatDialog } from '@angular/material/dialog';
import { SerialPortService } from '../../../../driver/serialport/serial-port.service'
import { I2CDriver } from '../../../../driver/i2c/i2c-driver'
import { HMC5883L } from '../../../../driver/sensors/HMC5883L'

@Component({
    selector: 'app-hmc5883l',
    templateUrl: './hmc5883l.component.html',
    styleUrls: ['./hmc5883l.component.scss'],
})
export class HMC5883LComponent implements OnInit, OnDestroy {
    private i2c: I2CDriver
    private compass: HMC5883L
    public axes: HMC5883L.MagneticData = {
        x: 0,
        y: 0,
        z: 0,
    }
    private _portName: string

    constructor(private serialPortService: SerialPortService, public dialog: MatDialog) {}

    @Input()
    set portName(portName: string) {
        this._portName = portName
    }

    ngOnInit() {}

    async ngOnDestroy() {
        await this.i2c.disconnect()
    }

    async startCompass() {
        this.i2c = new I2CDriver(this.serialPortService, this._portName)
        console.info('Status: ' + JSON.stringify(await this.i2c.connect()))
        this.compass = new HMC5883L(this.i2c)
        await this.compass.init()
        this.compass.startContinuousReader(axes => {
            this.axes = axes
        })

        /*this.compass
            .startCalibration((minAxesData, maxAxesData) => {
                this.axes = minAxesData
                this.axes2 = maxAxesData
            })
            .then(result => {
                console.log(result)
                this.test = JSON.stringify(result)
            })*/
    }

    async stopCompass() {
        this.compass.stopContinuousReader()
        await this.i2c.reset()
        await this.i2c.disconnect()
        //console.log(this.compass.abortCalibration())
    }
}
