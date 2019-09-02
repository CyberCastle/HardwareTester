import { Injectable } from '@angular/core'
import * as SerialPort from 'serialport'

@Injectable({
    providedIn: 'root',
})
export class SerialPortService {
    serialPort: typeof SerialPort

    get isElectron() {
        return window && window.process && window.process.type
    }

    constructor() {
        // Conditional imports
        if (this.isElectron) {
            // SerialPort support
            this.serialPort = window.require('serialport')
        }
    }
}
