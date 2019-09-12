import { I2CDriver } from './../i2c/i2c-driver'

/**
 * Technical documentation: https://www.adafruit.com/datasheets/HMC5883L_3-Axis_Digital_Compass_IC.pdf
 * Based on code from: https://github.com/rm-hull/hmc5883l/blob/master/hmc5883l.py and
 * https://github.com/psiphi75/compass-hmc5883l/blob/master/Compass.js
 */

export class HMC5883L {
    public readonly HMC5883L_ADDRESS = 0x1e
    public readonly HMC5883L_READ_BLOCK = 0x00

    // Configuration Register A: See pp12 of the technical documentation.
    public readonly HMC5883L_CONFIG_A_REGISTER = 0x00
    public readonly DEFAULT_CFG_A_MA = 0x03 // MA1 to MA0 - 8 samples on average
    public readonly DEFAULT_SAMPLE_RATE = 15

    // Configuration Register B: See pp13 of the technical documentation.
    public readonly HMC5883L_SCALE_REGISTER = 0x01
    public readonly DEFAULT_SCALE = 0.88
    public readonly HMC5883L_MODE_REGISTER = 0x02
    public readonly HMC5883L_MODE_MEASURE_CONTINUOUS = 0x00
    public readonly HMC5883L_MODE_MEASUREMENT_SINGLE_SHOT = 0x01
    public readonly HMC5883L_MODE_MEASUREMENT_IDLE = 0x03

    public readonly DEFAULT_CALIBRATION: HMC5883L.CalibrationData = {
        offset: {
            x: 0,
            y: 0,
            z: 0,
        },
        scale: {
            x: 1,
            y: 1,
            z: 1,
        },
    }

    public readonly DEFAULT_OPTIONS: HMC5883L.Options = {
        scale: this.DEFAULT_SCALE,
        sampleRate: this.DEFAULT_SAMPLE_RATE,
        declination: 0,
        calibration: this.DEFAULT_CALIBRATION,
    }

    private readonly sampleRateMap = {
        0.75: 0,
        1.5: 1,
        3: 2,
        7.5: 3,
        15: 4 /* Default value */,
        30: 5,
        75: 6,
    }

    private readonly scaleMap = {
        0.88: { reg: 0, scalar: 0.73 } /* Default value */,
        1.3: { reg: 1, scalar: 0.92 },
        1.9: { reg: 2, scalar: 1.22 },
        2.5: { reg: 3, scalar: 1.52 },
        4.0: { reg: 4, scalar: 2.27 },
        4.7: { reg: 5, scalar: 2.56 },
        5.6: { reg: 6, scalar: 3.03 },
        8.1: { reg: 7, scalar: 4.35 },
    }

    private declination: number
    private scale: any
    private config_A_value: number

    /**
     * Constructor
     * @param {I2CDriver} i2c the i2c library (such that we don't have to load it twice).
     * @param {number}    i2cBusNum The i2c bus number.
     * @param {object}    options   The additional options.
     *
     * Options:
     *   scale (string): The scale range to use.  See pp13 of the technical documentation.  Default is '0.88'.
     *   sampleRate (string): The sample rate (Hz), must be one of .  Default is '15' Hz (samples per second).
     *   declination (number): The declination, in degrees.  If this is provided the result will be true north, as opposed to magnetic north.
     *   calibration {CalibrationData}: alibration data to get more accurate results out of the magnetometer
     */
    public constructor(private i2c: I2CDriver, private options?: HMC5883L.Options) {
        if (!options) {
            this.options = this.DEFAULT_OPTIONS
        }

        // Set up the scale setting
        this.scale = this.scaleMap[this.options.scale]

        // Set up the config_A_value
        this.config_A_value = (this.DEFAULT_CFG_A_MA << 5) | (this.options.sampleRate << 2)

        // Set up declination
        this.declination = (this.options.declination / 180) * Math.PI
    }

    /**
     * Set the magnetic declination, in degrees.
     *
     * @param  {number} declination The magnetic declination in degrees.
     */
    public setDeclination(declination: number): void {
        this.declination = (declination / 180) * Math.PI
    }

    /**
     * Initalize the compass.
     */
    public async init(): Promise<void> {
        // Initializing the HMC5883L module.
        try {
            await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_CONFIG_A_REGISTER, this.config_A_value)
            await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_SCALE_REGISTER, this.scale.reg << 5)
            await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_MODE_REGISTER, this.HMC5883L_MODE_MEASURE_CONTINUOUS)
        } catch (ex) {
            console.error('HMC5883L.init(): there was an error initializing: ', ex)
        }
    }

    /**
     * Get the scaled and calibrated values from the compass.
     * @param  {Function} callback The standard callback -> (err, {x:number, y:number, z:number})
     */
    public async getRawValues(): Promise<HMC5883L.Axis> {
        // The 12 bytes of the register are read
        let buf = await this.i2c.i2cRegRead(this.HMC5883L_ADDRESS, this.HMC5883L_READ_BLOCK, 12)
        let readError = false
        let self = this

        function twos_complement(val: number, bits: number) {
            if ((val & (1 << (bits - 1))) !== 0) {
                val = val - (1 << bits)
            }
            return val
        }

        function convert(offset: number) {
            var val = twos_complement((buf[offset] << 8) | buf[offset + 1], 16)
            if (val === -4096) {
                readError = true
                return null
            }
            return val * self.scale.scalar
        }

        const axes: HMC5883L.Axis = {
            x: (convert(3) + this.options.calibration.offset.x) * this.options.calibration.scale.x,
            y: (convert(7) + this.options.calibration.offset.y) * this.options.calibration.scale.y,
            z: (convert(5) + this.options.calibration.offset.z) * this.options.calibration.scale.z,
        }

        return new Promise((resolve, reject) => {
            if (readError) {
                reject('Error to obtain the information of the xyz axes')
            }

            resolve(axes)
        })
    }
}

export declare namespace HMC5883L {
    interface Axis {
        x: number
        y: number
        z: number
    }

    interface Options {
        scale: number
        sampleRate: number
        declination: number
        calibration: CalibrationData
    }

    interface CalibrationData {
        offset: {
            x: number
            y: number
            z: number
        }
        scale: {
            x: number
            y: number
            z: number
        }
    }
}
