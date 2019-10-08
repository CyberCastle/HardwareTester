import { AngularMaterialModule } from './angular-material.module'
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome'
import { faFolderOpen, faSave, faPlay, faStop, faPaintRoller } from '@fortawesome/free-solid-svg-icons'
import { CodemirrorModule } from '@ctrl/ngx-codemirror'

// Components
import { JsEditorComponent } from './components/js-editor/js-editor.component'

@NgModule({
    declarations: [JsEditorComponent],
    imports: [CommonModule, AngularMaterialModule, FormsModule, FontAwesomeModule, CodemirrorModule],
    exports: [AngularMaterialModule, JsEditorComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CoreModule {
    constructor(iconLibrary: FaIconLibrary) {
        // Add an icon to the library for convenient access in other components
        iconLibrary.addIcons(faFolderOpen, faSave, faPlay, faStop, faPaintRoller)
    }
}
