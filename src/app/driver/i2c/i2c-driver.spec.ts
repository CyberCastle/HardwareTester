import { I2CDriver } from './i2c-driver'
import { SerialPortService } from '../../core/services/hardware/serial-port.service'

describe('I2CDriver', () => {
    it('should create an instance', () => {
        expect(new I2CDriver(new SerialPortService(), '')).toBeTruthy()
    })
})
