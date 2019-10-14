import { AngularMaterialModule } from './angular-material.module'
import { FlexLayoutModule } from '@angular/flex-layout'
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome'
import { faFolderOpen, faSave, faPlay, faStop, faPaintRoller, faBroom } from '@fortawesome/free-solid-svg-icons'
import { CodemirrorModule } from '@ctrl/ngx-codemirror'

// Components
import { JsEditorComponent } from './components/js-editor/js-editor.component'
import { I2cDriverComponent } from './components/i2c-driver/i2c-driver.component'
import { HMC5883LComponent } from './components/sensors/hmc5883l/hmc5883l.component'

@NgModule({
    declarations: [JsEditorComponent, I2cDriverComponent, HMC5883LComponent],
    imports: [CommonModule, AngularMaterialModule, FlexLayoutModule, FormsModule, FontAwesomeModule, CodemirrorModule],
    exports: [AngularMaterialModule, JsEditorComponent, I2cDriverComponent, HMC5883LComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CoreModule {
    constructor(iconLibrary: FaIconLibrary) {
        // Add an icon to the library for convenient access in other components
        iconLibrary.addIcons(faFolderOpen, faSave, faPlay, faStop, faPaintRoller, faBroom)
    }
}
