import { I2CDriver } from './../i2c/i2c-driver'
import { Timeout } from '../../utils/await-timeout'

/**
 * Technical documentation: https://www.adafruit.com/datasheets/HMC5883L_3-Axis_Digital_Compass_IC.pdf
 * Based on code from:
 * https://github.com/rm-hull/hmc5883l/blob/master/hmc5883l.py
 * and
 * https://github.com/psiphi75/compass-hmc5883l/blob/master/Compass.js
 *
 * Calibration code is based from:
 * https://github.com/helscream/HMC5883L_Header_Arduino_Auto_calibration/blob/master/Core/Compass_header_example_ver_0_2/compass.cpp
 * and
 * https://github.com/pganssle/HMC5883L/blob/master/HMC5883L.cpp
 */

export class HMC5883L {
    public readonly HMC5883L_ADDRESS = 0x1e
    public readonly HMC5883L_READ_BLOCK = 0x00

    // Configuration Register A: See pp12 of the technical documentation.
    public readonly HMC5883L_CONFIGURATION_REGISTER_A_ADDRESS = 0x00
    public readonly DEFAULT_SAMPLES_AVERAGED = 0x03 // MA1 to MA0 - 8 samples on average
    public readonly HMC5883L_MEASUREMENT_MODE_NORMAL = 0x00
    public readonly HMC5883L_MEASUREMENT_MODE_POSITIVE_BIAS = 0x01
    public readonly HMC5883L_MEASUREMENT_MODE_NEGATIVE_BIAS = 0x02
    public readonly DEFAULT_SAMPLE_RATE = 15

    // Configuration Register B: See pp13 of the technical documentation.
    public readonly HMC5883L_CONFIGURATION_REGISTER_B_ADDRESS = 0x01
    public readonly DEFAULT_SCALE = 0.88

    // Configuration Mode Register: See pp14 of the technical documentation.
    public readonly HMC5883L_MODE_REGISTER_ADDRESS = 0x02
    public readonly HMC5883L_OPERATING_MODE_CONTINUOUS = 0x00
    public readonly HMC5883L_OPERATING_MODE_SINGLE_SHOT = 0x01
    public readonly HMC5883L_OPERATING_MODE_IDLE = 0x02

    public readonly DEFAULT_CALIBRATION: HMC5883L.CalibrationData = {
        offset: {
            x: 0,
            y: 0,
            z: 0,
        },
        gainError: {
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
        0.88: { reg: 0, scalar: 0.73 }, // 0.88 Gauss =  88 uTesla --> Default value
        1.3: { reg: 1, scalar: 0.92 }, // 1.3 Gauss = 130 uTesla
        1.9: { reg: 2, scalar: 1.22 }, // 1.9 Gauss = 190 uTesla
        2.5: { reg: 3, scalar: 1.52 }, // 2.5 Gauss = 250 uTesla
        4.0: { reg: 4, scalar: 2.27 }, // 4.0 Gauss = 400 uTesla
        4.7: { reg: 5, scalar: 2.56 }, // 4.7 Gauss = 470 uTesla
        5.6: { reg: 6, scalar: 3.03 }, // 5.6 Gauss = 560 uTesla
        8.1: { reg: 7, scalar: 4.35 }, // 8.1 Gauss = 810 uTesla
    }

    /**
     * The HMC5883L has a self-test mode which applies either a negative or positive bias field along
     * all three channels; the mode is set in the bottom two bits of the Configuration Register A.
     * The applied bias fields along all three axes are:
     *
     * | Axis | Bias-on field (mG) |
     * | :--: | :----------------- |
     * |   X  |  ±1160             |
     * |   Y  |  ±1160             |
     * |   Z  |  ±1080             |
     * In the negative and positive bias modes, each "measurement" consists of two measurements, a
     * measurement with the bias field applied and one without, and the device returns the difference.
     */
    private readonly compass_XY_excitation = 1160 // The magnetic field excitation in X and Y direction during Self Test (Calibration)
    private readonly compass_Z_excitation = 1080 // The magnetic field excitation in Z direction during Self Test (Calibration)

    private declination: number
    private scale: any
    private defaultRegister_A_value: number
    public isContinuousReader: boolean

    // Calibration result object
    private calibrationResult: HMC5883L.CalibrationData = {
        offset: {
            x: 0,
            y: 0,
            z: 0,
        },
        gainError: {
            x: 1,
            y: 1,
            z: 1,
        },
    }

    /**
     * Constructor
     * @param {I2CDriver} i2c The i2c library (such that we don't have to load it twice).
     * @param {HMC5883L.Options} options The additional options.
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

        // Continuos Reader stopped
        this.isContinuousReader = false

        // Set up the scale setting
        this.scale = this.scaleMap[this.options.scale]

        // Set up the config_A_value
        this.defaultRegister_A_value = (this.DEFAULT_SAMPLES_AVERAGED << 5) | (this.sampleRateMap[this.options.sampleRate] << 2)

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
            await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_CONFIGURATION_REGISTER_A_ADDRESS, this.defaultRegister_A_value)
            await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_CONFIGURATION_REGISTER_B_ADDRESS, this.scale.reg << 5)
            await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_MODE_REGISTER_ADDRESS, this.HMC5883L_OPERATING_MODE_CONTINUOUS)
        } catch (ex) {
            console.error('HMC5883L.init(): there was an error initializing: ', ex)
        }
    }

    /**
     * Get raw values from the compass.
     */
    private async getRawValues(): Promise<HMC5883L.Axis> {
        // The 12 bytes of the register are read
        let buf = await this.i2c.i2cRegRead(this.HMC5883L_ADDRESS, this.HMC5883L_READ_BLOCK, 12)
        let readError = false

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
                console.error('Error to obtain the information of the xyz axes')
                return null
            }
            return val
        }

        const axes: HMC5883L.Axis = {
            x: convert(3) * this.scale.scalar,
            y: convert(7) * this.scale.scalar,
            z: convert(5) * this.scale.scalar,
        }

        await Timeout.sleep(50) // Wait 70ns (50 + 20ns configurated in SerialPortBase class), before read the next values
        return new Promise((resolve, reject) => {
            if (readError) {
                reject('Error to obtain the information of the xyz axes')
            }

            resolve(axes)
        })
    }

    /**
     * Get the scaled and calibrated values from the compass.
     */
    private async getCalibratedValues(): Promise<HMC5883L.Axis> {
        const rawAxes = await this.getRawValues()
        const calibratedAxes: HMC5883L.Axis = {
            x: rawAxes.x * this.options.calibration.gainError.x + this.options.calibration.offset.x,
            y: rawAxes.y * this.options.calibration.gainError.y + this.options.calibration.offset.y,
            z: rawAxes.z * this.options.calibration.gainError.z + this.options.calibration.offset.z,
        }

        return new Promise((resolve, reject) => {
            resolve(calibratedAxes)
        })
    }

    public async startContinuousReader(cb: (axesData: HMC5883L.Axis) => void): Promise<void> {
        if (this.isContinuousReader) {
            return
        }

        this.isContinuousReader = true
        while (this.isContinuousReader) {
            cb(await this.getCalibratedValues())
        }
    }

    public stopContinuousReader(): void {
        this.isContinuousReader = false
    }

    /**
     * This Function calculates the offset in the Magnetometer
     * using Positive and Negative bias Self test capability
     */
    public async startCalibration(cb: (minAxesData: HMC5883L.Axis, maxAxesData: HMC5883L.Axis) => void): Promise<HMC5883L.CalibrationData> {
        if (this.isContinuousReader) {
            return
        }

        // *****************************************************************************************
        // Gain offset estimation
        // *****************************************************************************************

        // Configuring the Control register for Positive Bias mode
        let register_A_value = this.defaultRegister_A_value | this.HMC5883L_MEASUREMENT_MODE_POSITIVE_BIAS
        await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_CONFIGURATION_REGISTER_A_ADDRESS, register_A_value)
        await Timeout.sleep(10) // Wait for ready

        // Reading the Positive baised Data
        let positiveBiasAxes = await this.getRawValues() // Disregarding the first data
        while (positiveBiasAxes.x < 200 || positiveBiasAxes.y < 200 || positiveBiasAxes.x < 200) {
            positiveBiasAxes = await this.getRawValues() // Making sure the data is with Positive baised
        }

        let compass_x_gainError = this.compass_XY_excitation / positiveBiasAxes.x
        let compass_y_gainError = this.compass_XY_excitation / positiveBiasAxes.y
        let compass_z_gainError = this.compass_Z_excitation / positiveBiasAxes.z

        // Configuring the Control register for Negative Bias mode
        register_A_value = this.defaultRegister_A_value | this.HMC5883L_MEASUREMENT_MODE_NEGATIVE_BIAS
        await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_CONFIGURATION_REGISTER_A_ADDRESS, register_A_value)
        await Timeout.sleep(10) // Wait for ready

        // Reading the Negative baised Data
        let negativeBiasAxes = await this.getRawValues() // Disregarding the first data
        while (negativeBiasAxes.x > -200 || negativeBiasAxes.y > -200 || negativeBiasAxes.x > -200) {
            negativeBiasAxes = await this.getRawValues() // Making sure the data is with Negative baised
        }

        // Saving the result of the calibration
        this.calibrationResult.gainError = {
            x: (this.compass_XY_excitation / Math.abs(negativeBiasAxes.x) + compass_x_gainError) / 2,
            y: (this.compass_XY_excitation / Math.abs(negativeBiasAxes.y) + compass_y_gainError) / 2,
            z: (this.compass_Z_excitation / Math.abs(negativeBiasAxes.z) + compass_z_gainError) / 2,
        }

        // *****************************************************************************************
        // Offset estimation
        // *****************************************************************************************

        // Configuring the Control register for normal mode
        await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_CONFIGURATION_REGISTER_A_ADDRESS, this.defaultRegister_A_value)
        await Timeout.sleep(10) // Wait for ready

        /**
         * Once the calibration is started you will want to move the sensor around all axes.  What we want is to find the
         * extremes (min/max) of the x, y, z values such that we can find the offset and scale values.
         *
         * Please rotate the magnetometer 2 or 3 times in complete circules with in one minute...
         */

        let compass_x_scalled: number, compass_y_scalled: number, compass_z_scalled: number
        let minAxes: HMC5883L.Axis = {
            x: Infinity,
            y: Infinity,
            z: Infinity,
        }
        let maxAxes: HMC5883L.Axis = {
            x: -Infinity,
            y: -Infinity,
            z: -Infinity,
        }

        const startTime = new Date().getTime()
        this.isContinuousReader = true
        while (new Date().getTime() - startTime <= 60000 && this.isContinuousReader) {
            let axes = await this.getRawValues()

            compass_x_scalled = axes.x * compass_x_gainError
            compass_y_scalled = axes.y * compass_y_gainError
            compass_z_scalled = axes.z * compass_z_gainError

            minAxes.x = Math.min(minAxes.x, compass_x_scalled)
            minAxes.y = Math.min(minAxes.y, compass_y_scalled)
            minAxes.z = Math.min(minAxes.z, compass_z_scalled)

            maxAxes.x = Math.max(maxAxes.x, compass_x_scalled)
            maxAxes.y = Math.max(maxAxes.y, compass_y_scalled)
            maxAxes.z = Math.max(maxAxes.z, compass_z_scalled)

            cb(minAxes, maxAxes)
        }

        this.calibrationResult.offset = {
            x: (maxAxes.x - minAxes.x) / 2 - maxAxes.x,
            y: (maxAxes.y - minAxes.y) / 2 - maxAxes.y,
            z: (maxAxes.z - minAxes.z) / 2 - maxAxes.z,
        }

        return new Promise((resolve, reject) => {
            resolve(this.calibrationResult)
        })
    }

    public abortCalibration(): HMC5883L.CalibrationData {
        this.isContinuousReader = false
        return this.calibrationResult
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
        gainError: {
            x: number
            y: number
            z: number
        }
    }
}
