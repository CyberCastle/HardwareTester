import { I2CDriver } from './../i2c/i2c-driver'
import { Timeout } from '../../utils/await-timeout'

/**
 * Technical documentation: https://www.adafruit.com/datasheets/HMC5883L_3-Axis_Digital_Compass_IC.pdf
 * Based on code from:
 * https://github.com/rm-hull/hmc5883l/blob/master/hmc5883l.py
 * and
 * https://github.com/psiphi75/compass-hmc5883l/blob/master/Compass.js
 * and
 * https://github.com/DFRobot/DFRobot_QMC5883/blob/master/DFRobot_QMC5883.cpp
 *
 * Calibration code is based from:
 * https://github.com/helscream/HMC5883L_Header_Arduino_Auto_calibration/blob/master/Core/Compass_header_example_ver_0_2/compass.cpp
 * and
 * https://github.com/pganssle/HMC5883L/blob/master/HMC5883L.cpp
 */

export class HMC5883L {
    public readonly HMC5883L_ADDRESS = 0x1e

    private readonly HMC5883L_CONFIGURATION_REGISTER_A_ADDRESS = 0x00
    private readonly HMC5883L_CONFIGURATION_REGISTER_B_ADDRESS = 0x01
    private readonly HMC5883L_MODE_REGISTER_ADDRESS = 0x02
    private readonly HMC5883L_DATAOUTPUT_REGISTER_ADDRESS_BLOCK = 0x03

    // Parameters for calibration
    private readonly HMC5883L_MEASUREMENT_MODE_POSITIVE_BIAS = 0x01
    private readonly HMC5883L_MEASUREMENT_MODE_NEGATIVE_BIAS = 0x02

    // Calibration result object
    private internalCalibrationResult: HMC5883L.CalibrationData = {
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

    // Map with gain digital resolution values
    private readonly gainResolutionMap: Map<HMC5883L.GainRange, number> = new Map()

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
    private defaultRegister_A_value: number
    private isContinuousReader: boolean

    public readonly DEFAULT_OPTIONS: HMC5883L.Options = {
        samples: HMC5883L.SamplesAverage.SAMPLES_8,
        dataRate: HMC5883L.DataOutputRate.RATE_15HZ,
        gainRange: HMC5883L.GainRange.GAIN_1_3,
        mode: HMC5883L.OperationMode.CONTINOUS,
        declination: 0,
        calibration: this.internalCalibrationResult,
    }

    /**
     * Constructor
     * @param {I2CDriver} i2c The i2c library (such that we don't have to load it twice).
     * @param {HMC5883L.Options} options The additional options.
     *
     */
    public constructor(private i2c: I2CDriver, private options?: HMC5883L.Options) {
        if (!options) {
            this.options = this.DEFAULT_OPTIONS
        }

        // Continuos Reader stopped by default
        this.isContinuousReader = false

        // Set gain digital resolution values
        this.gainResolutionMap.set(HMC5883L.GainRange.GAIN_0_8, 0.73)
        this.gainResolutionMap.set(HMC5883L.GainRange.GAIN_1_3, 0.92)
        this.gainResolutionMap.set(HMC5883L.GainRange.GAIN_1_9, 1.22)
        this.gainResolutionMap.set(HMC5883L.GainRange.GAIN_2_5, 1.52)
        this.gainResolutionMap.set(HMC5883L.GainRange.GAIN_4_0, 2.27)
        this.gainResolutionMap.set(HMC5883L.GainRange.GAIN_4_7, 2.56)
        this.gainResolutionMap.set(HMC5883L.GainRange.GAIN_5_6, 3.03)
        this.gainResolutionMap.set(HMC5883L.GainRange.GAIN_8_1, 4.35)

        // Set up the config_A_value
        this.defaultRegister_A_value = this.options.samples | this.options.dataRate

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
        try {
            await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_CONFIGURATION_REGISTER_A_ADDRESS, this.defaultRegister_A_value)
            await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_CONFIGURATION_REGISTER_B_ADDRESS, this.options.gainRange)
            await this.i2c.i2cRegWrite(this.HMC5883L_ADDRESS, this.HMC5883L_MODE_REGISTER_ADDRESS, this.options.mode)
        } catch (ex) {
            console.error('HMC5883L.init(): there was an error initializing: ', ex)
            return Promise.reject(ex)
        }
    }

    public async startContinuousReader(cb: (axesData: HMC5883L.MagneticData) => void): Promise<void> {
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

    public abortCalibration(): HMC5883L.CalibrationData {
        this.isContinuousReader = false
        return this.internalCalibrationResult
    }

    /**
     * This Function calculates the offset in the Magnetometer
     * using Positive and Negative bias Self test capability
     */
    public async startCalibration(
        cb: (minAxesData: HMC5883L.MagneticData, maxAxesData: HMC5883L.MagneticData) => void
    ): Promise<HMC5883L.CalibrationData> {
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
        this.internalCalibrationResult.gainError = {
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
        let minAxes: HMC5883L.MagneticData = {
            x: Infinity,
            y: Infinity,
            z: Infinity,
        }
        let maxAxes: HMC5883L.MagneticData = {
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

        this.internalCalibrationResult.offset = {
            x: (maxAxes.x - minAxes.x) / 2 - maxAxes.x,
            y: (maxAxes.y - minAxes.y) / 2 - maxAxes.y,
            z: (maxAxes.z - minAxes.z) / 2 - maxAxes.z,
        }

        return new Promise((resolve, reject) => {
            resolve(this.internalCalibrationResult)
        })
    }

    /**
     * Get raw values from the compass.
     */
    private async getRawValues(): Promise<HMC5883L.MagneticData> {
        // The 6 bytes of the data output register are read
        const buffer = await this.i2c.i2cRegRead(this.HMC5883L_ADDRESS, this.HMC5883L_DATAOUTPUT_REGISTER_ADDRESS_BLOCK, 6)
        const axes: HMC5883L.MagneticData = {
            x: this.getValueFromRegister(buffer, 0) * this.gainResolutionMap.get(this.options.gainRange),
            y: this.getValueFromRegister(buffer, 2) * this.gainResolutionMap.get(this.options.gainRange),
            z: this.getValueFromRegister(buffer, 4) * this.gainResolutionMap.get(this.options.gainRange),
        }

        await Timeout.sleep(70) // Wait 70ms, before read the next values
        return Promise.resolve(axes)
    }

    private getValueFromRegister(registerData: Uint8Array, position: number) {
        const value = this.twosCompliment16((registerData[position] << 8) | registerData[position + 1])
        if (value === -4096) {
            console.error('Overflow Error: Saturated readings in the information of the xyz axes.')
            return NaN
        }
        return value
    }

    private twosCompliment16(i: number): number {
        if (i > 0x8000) {
            return i - 0x10000
        }
        return i
    }

    /**
     * Get the calibrated values from the compass.
     */
    private async getCalibratedValues(): Promise<HMC5883L.MagneticData> {
        const rawAxes = await this.getRawValues()
        const calibratedAxes: HMC5883L.MagneticData = {
            x: rawAxes.x * this.options.calibration.gainError.x + this.options.calibration.offset.x,
            y: rawAxes.y * this.options.calibration.gainError.y + this.options.calibration.offset.y,
            z: rawAxes.z * this.options.calibration.gainError.z + this.options.calibration.offset.z,
        }

        return new Promise((resolve, reject) => {
            resolve(calibratedAxes)
        })
    }
}
export declare namespace HMC5883L {
    interface MagneticData {
        x: number
        y: number
        z: number
    }

    // Configuration Register A: See pp12 of the technical documentation.
    const enum SamplesAverage {
        SAMPLES_1 = 0b00000000, // 1 samples per measurement
        SAMPLES_2 = 0b00100000, // 2 samples per measurement
        SAMPLES_4 = 0b01000000, // 4 samples per measurement
        SAMPLES_8 = 0b01100000, // 4 samples per measurement
    }

    // Configuration Register A: See pp12 of the technical documentation.
    const enum DataOutputRate {
        RATE_0_75_HZ = 0b00000000, // 0.75Hz
        RATE_1_5HZ = 0b00000100, // 1.5Hz
        RATE_3_0HZ = 0b00001000, // 3.0Hz
        RATE_7_5HZ = 0b00001100, // 7.5Hz
        RATE_15HZ = 0b00010000, // 15Hz
        RATE_30HZ = 0b00010100, // 30Hz
        RATE_75HZ = 0b00011000, // 75Hz
    }

    // Configuration Register B: See pp13 of the technical documentation.
    const enum GainRange {
        GAIN_0_8 = 0b00000000, // +/- 0.8 Ga
        GAIN_1_3 = 0b00100000, // +/- 1.3 Ga
        GAIN_1_9 = 0b01000000, // +/- 1.9 Ga
        GAIN_2_5 = 0b01100000, // +/- 2.5 Ga
        GAIN_4_0 = 0b10000000, // +/- 4.0 Ga
        GAIN_4_7 = 0b10100000, // +/- 4.7 Ga
        GAIN_5_6 = 0b11000000, // +/- 5.6 Ga
        GAIN_8_1 = 0b11100000, // +/- 8.1 Ga
    }

    // Configuration Mode Register: See pp14 of the technical documentation.
    const enum OperationMode {
        CONTINOUS = 0b00000000,
        SINGLE = 0b00000001,
        IDLE = 0b00000010,
    }

    interface Options {
        samples: SamplesAverage
        dataRate: DataOutputRate
        gainRange: GainRange
        mode: OperationMode
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
