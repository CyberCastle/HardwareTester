import { SerialPortService } from '../serialport/serial-port.service'
import { SerialPortBase } from '../serialport/serial-port'
import { Timeout } from '../../utils/await-timeout'
import { sscanf } from 'scanf'
import { assert, expect } from 'chai'

export class I2CDriver extends SerialPortBase {
    constructor(
        private serialPortService: SerialPortService,
        private portName: string,
        private errorCallback?: SerialPortBase.ErrorCallback
    ) {
        super(serialPortService, portName, 1000000)
    }

    public async connect(reset: boolean = true): Promise<I2CDriver.Status> {
        await this._connect(this.errorCallback)

        // May be in capture or monitor mode, send '@' char and wait for 50 ms
        await this._write(new Uint8Array([0x40]))
        Timeout.sleep(50)

        // May be waiting up to 64 bytes of input (command code 0xff). Send a array with 64 '@'.
        await this._write(new Uint8Array(64).fill(0x40))
        await this._clearBuffer()

        // Echo chars are ASCII representations of: 'A', 'CR', 'LF' and 'Z'
        const ecoChars = new Uint8Array([0x41, 0x0d, 0x0a, 0x5a])

        for (let i = 0; i < ecoChars.length; i++) {
            let ecoChar = await this.echo(ecoChars[i])
            if (ecoChar.length > 1 || ecoChar[0] != ecoChars[i]) {
                return new Promise<I2CDriver.Status>((resolve, reject) => {
                    reject(new Error(`Echo test failed. Expected ${ecoChars[i]} but received ${ecoChar}`))
                })
            }
        }

        // Get status from device, after successful connection.
        const status = await this.getStatus()
        if (reset || (status.sda_state != 1 && status.scl_state != 1)) {
            await this.i2cReset()
            return this.getStatus()
        }

        return new Promise<I2CDriver.Status>((resolve, reject) => {
            resolve(status)
        })
    }

    public async echo(char: number): Promise<Uint8Array> {
        // The echo command is 'e' (ASCII code: 0x65)
        await this._write(new Uint8Array([0x65, char]))
        return this._read()
    }

    public async getStatus(): Promise<I2CDriver.Status> {
        // The status command is 'e' (ASCII code: 0x3F)
        await this._write(new Uint8Array([0x3f]))
        const statusBuffer = await this._read()
        const status = sscanf(statusBuffer.toString(), '[%s %s %d %f %f %f %s %d %d %d %d %x ]')

        return new Promise<I2CDriver.Status>((resolve, reject) => {
            const _status: I2CDriver.Status = {
                port: this.portName,
                model: '' + status[0],
                serial: '' + status[1],
                uptime: +status[2],
                voltage: +status[3],
                current: +status[4],
                temperature: +status[5],
                mode: +status[6],
                sda_state: +status[7],
                scl_state: +status[8],
                scl_speed: +status[9],
                scl_pullups: +status[10],
                scl_ccitt_crc: +status[11],
                scl_e_ccitt_crc: 0,
            }
            resolve(_status)
        })
    }

    public async reset(): Promise<void> {
        // The reset command is '_' (ASCII code: 0x5F)
        await this._write(new Uint8Array([0x5f]))
        return Timeout.sleep(500)
    }

    public async setPullups(controlBits: number): Promise<void> {
        expect(controlBits, 'Between 0 and 63, both inclusive, are the allowed values')
            .to.be.least(0)
            .and.to.be.below(64)

        // The pullups setting command is 'u' (ASCII code: 0x75)
        return this._write(new Uint8Array([0x75, controlBits]))
    }

    public async scan(print: boolean = false): Promise<number[]> {
        // The i2c port scan command is 'd' (ASCII code: 0x64)
        await this._write(new Uint8Array([0x64]))
        const bitAddressList = [...(await this._read(30))]
        const hexAddressList: number[] = []
        let printLine: string[] = []
        let line = 0

        bitAddressList.map((bitAddress, index) => {
            let i2cAddress = index + 8

            if (print) {
                // Each address found is indicated with a '1' character (ASCII code: 0x31)
                if (bitAddress == 0x31) {
                    printLine.push(i2cAddress.toString(16).toUpperCase())
                } else {
                    printLine.push('--')
                }

                if (i2cAddress % 8 == 7) {
                    console.info((++line).toString().padStart(2, '0') + ') ' + printLine.join(' '))
                    printLine = []
                }
            }

            if (bitAddress == 0x31) {
                hexAddressList.push(i2cAddress)
            }
        })

        return new Promise((resolve, reject) => {
            resolve(hexAddressList)
        })
    }

    public i2cSpeed(speed: number): Promise<void> {
        assert.include([100, 400], speed, 'Only 100 or 400 are the allowed values.')

        // The speed settings command is 1 or 4 (ASCII code: 0x31 y 0x34), for 100KHz/400KHz respectively
        const speedValue = { 100: 0x31, 400: 0x34 }[speed]
        return this._write(new Uint8Array([speedValue]))
    }

    public async i2cReset(): Promise<void> {
        // The reset i2c bus command is 'x' (ASCII code: 0x78)
        await this._write(new Uint8Array([0x78]))
        const response = await this._read()

        return new Promise<void>((resolve, reject) => {
            // If reset is successful, the device return a '3' character (ASCII code: 0x33)
            if (response.length > 1 || response[0] != 0x33) {
                reject('I2C bus is busy')
            } else {
                this.i2cSpeed(100).then(() => {
                    console.info('I2C Bus reset')
                    resolve()
                })
            }
        })
    }

    public async i2cRestore(): Promise<void> {
        // The restore i2c bus command (leave bitmang) is 'i' (ASCII code: 0x69)
        return this._write(new Uint8Array([0x69]))
    }

    public async i2cStart(i2cPort: number, rw: boolean = false): Promise<boolean> {
        // The start i2c comunications command is 's' (ASCII code: 0x73)
        const port = (i2cPort << 1) | (!rw ? 1 : 0) // read (1),  write (0)
        await this._write(new Uint8Array([0x73, port]))

        return this.i2cAck()
    }

    public async i2cStop(): Promise<void> {
        // The stop i2c comunications command is 'p' (ASCII code: 0x70)
        return this._write(new Uint8Array([0x70]))
    }

    public async i2cWrite(dataArray: Uint8Array): Promise<boolean> {
        const dataArraySize = dataArray.length
        let ack: boolean

        for (let i = 0; i < dataArraySize; i += 64) {
            let len = dataArraySize - i < 64 ? dataArraySize - i : 64
            let data = new Uint8Array(len + 1)
            data[0] = 0xc0 + len - 1
            data.set(dataArray.slice(i, len - 1), i + 1)
            await this._write(data)
            ack = await this.i2cAck()
        }

        return new Promise<boolean>((resolve, reject) => {
            resolve(ack)
        })
    }

    public async i2cRead(numBytes: number): Promise<Uint8Array> {
        const dataArray = new Uint8Array(numBytes)

        for (let i = 0; i < numBytes; i += 64) {
            let len = numBytes - i < 64 ? numBytes - i : 64
            await this._write(new Uint8Array([0x80 + len - 1]))
            let response = await this._read(30)
            dataArray.set(response.slice(0, len), i)
        }

        return new Promise<Uint8Array>((resolve, reject) => {
            resolve(dataArray)
        })
    }

    public async i2cRegWrite(i2cPort: number, i2cRegister: number, data?: number | Uint8Array): Promise<boolean> {
        // Start device
        let ack = await this.i2cStart(i2cPort, true)

        // Select register
        if (ack) {
            ack = await this.i2cWrite(new Uint8Array([i2cRegister]))
        }

        // Write register
        if (ack) {
            if (typeof data === 'number') {
                ack = await this.i2cWrite(new Uint8Array([data]))
            } else {
                ack = await this.i2cWrite(data)
            }
        }

        // Stop device
        await this.i2cStop()
        return ack
    }

    public async i2cRegRead(i2cPort: number, i2cRegister: number, numBytes: number): Promise<Uint8Array> {
        // The read i2c register command is 'r' (ASCII code: 0x72)
        await this._write(new Uint8Array([0x72, i2cPort, i2cRegister, numBytes]))
        return this.i2cRead(numBytes)
    }

    private async i2cAck(): Promise<boolean> {
        const ack = await this._read()

        return new Promise<boolean>((resolve, reject) => {
            if (ack.length > 1) {
                reject('Timeout')
            }
            resolve((ack[0] & 1) != 0)
        })
    }
}

export declare namespace I2CDriver {
    interface Status {
        readonly port: string
        readonly model: string
        readonly serial: string
        readonly uptime: number
        readonly voltage: number
        readonly current: number
        readonly temperature: number
        readonly mode: number
        readonly sda_state: number
        readonly scl_state: number
        readonly scl_speed: number
        readonly scl_pullups: number
        readonly scl_ccitt_crc: number
        readonly scl_e_ccitt_crc: number
    }
}
