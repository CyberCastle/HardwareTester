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

        // May be in capture or monitor mode, send char and wait for 50 ms
        await this._write('@')
        Timeout.sleep(50)

        // May be waiting up to 64 bytes of input (command code 0xff)
        await this._write(
            '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
        )

        await this._clearBuffer()

        const ecoChars = [
            'A',
            String.fromCharCode(0xd),
            String.fromCharCode(0xa),
            'Z',
        ]

        for (let i = 0; i < ecoChars.length; i++) {
            let ecoChar = await this.echo(ecoChars[i])
            if (ecoChar.length > 1 || ecoChar != ecoChars[i]) {
                return new Promise<I2CDriver.Status>((resolve, reject) => {
                    reject(
                        new Error(
                            `Echo test failed. Expected ${ecoChars[i]} but received ${ecoChar}`
                        )
                    )
                })
            }
        }

        const status = await this.getStatus()

        if (reset || (status.sda_state != 1 && status.scl_state != 1)) {
            await this.reset()
            return this.getStatus()
        }

        return new Promise<I2CDriver.Status>((resolve, reject) => {
            resolve(status)
        })
    }

    public async echo(char: string): Promise<string> {
        assert.lengthOf(char, 1, 'Only 1 character is allowed.')
        await this._write('e' + char)
        return this._read()
    }

    public async getStatus(): Promise<I2CDriver.Status> {
        await this._write('?')
        const statusBuffer = await this._read()
        const status = sscanf(
            statusBuffer,
            '[%s %s %d %f %f %f %s %d %d %d %d %x ]'
        )

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

    public i2cSpeed(speed: number): Promise<void> {
        assert.include(
            [100, 400],
            speed,
            'Only 100 or 400 are the allowed values.'
        )

        let speedValue = { 100: '1', 400: '4' }[speed]
        return this._write(speedValue)
    }

    public async i2cReset(): Promise<void> {
        await this._write('x')
        const response = await this._read()

        return new Promise<void>((resolve, reject) => {
            if (response !== '3') {
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
        return this._write('i')
    }

    public async reset(): Promise<void> {
        return this._write('_')
    }

    public async setPullups(controlBits: number): Promise<void> {
        expect(
            controlBits,
            'Between 0 and 63, both inclusive, are the allowed values'
        )
            .to.be.least(0)
            .and.to.be.below(64)

        const controlBitsChar = String.fromCharCode(controlBits)
        return this._write('u' + controlBitsChar)
    }

    public async scan(print: boolean = false): Promise<number[]> {
        await this._write('d')
        const bitAddressList = [...(await this._read(30))]
        const hexAddressList: number[] = []
        let printLine: string[] = []
        let line = 0

        bitAddressList.map((bit, index) => {
            let i2cAddress = index + 8

            if (print) {
                if (bit == '1') {
                    printLine.push(i2cAddress.toString(16).toUpperCase())
                } else {
                    printLine.push('--')
                }

                if (i2cAddress % 8 == 7) {
                    console.info(
                        (++line).toString().padStart(2, '0') +
                            ') ' +
                            printLine.join(' ')
                    )
                    printLine = []
                }
            }

            if (bit == '1') {
                hexAddressList.push(i2cAddress)
            }
        })

        return new Promise((resolve, reject) => {
            resolve(hexAddressList)
        })
    }

    public start(): void {
        console.log('jj')
    }
    public stop(): void {
        console.log('jj')
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
