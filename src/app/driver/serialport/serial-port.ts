import { SerialPortService } from './serial-port.service'
import { Timeout } from '../../utils/await-timeout'
import * as SerialPort from 'serialport'

export abstract class SerialPortBase {
    protected constructor(private _portService: SerialPortService, private _portName: string, private _baudRate: number) {}

    private _port: SerialPort
    private buffer: string = ''
    private waitForResponseTime: number = 20

    protected async _connect(errorCallback?: SerialPortBase.ErrorCallback): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._port = new this._portService.serialPort(
                this._portName,
                {
                    baudRate: this._baudRate,
                },
                error => {
                    if (error != undefined) {
                        reject(error)
                    }
                }
            )

            this._port.on('data', data => {
                data.toString('binary')
                this.buffer += data
            })

            this._port.on('error', error => {
                if (errorCallback) {
                    errorCallback(error)
                }
            })

            this._port.on('open', data => {
                resolve()
            })
        })
    }

    protected async _write(text: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._port.write(text, 'binary', error => {
                if (error != undefined) {
                    reject(error)
                } else {
                    this._port.drain(error => {
                        if (error != undefined) {
                            reject(error)
                        } else {
                            resolve()
                        }
                    })
                }
            })
        })
    }

    protected async _read(waitTime: number = 0): Promise<string> {
        await Timeout.sleep(waitTime < this.waitForResponseTime ? this.waitForResponseTime : waitTime)
        return new Promise<string>((resolve, reject) => {
            const _buffer = this.buffer
            this.buffer = ''
            resolve(_buffer)
        })
    }

    protected async _clearBuffer(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._port.flush(error => {
                this.buffer = ''
                if (error != undefined) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }

    public async close(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._port.close(error => {
                if (error != undefined) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
}

export declare namespace SerialPortBase {
    type ErrorCallback = (error?: Error | null) => void
}
