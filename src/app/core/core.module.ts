import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import { CommonModule } from '@angular/common'
import { AngularMaterialModule } from './angular-material.module'

@NgModule({
    declarations: [],
    imports: [CommonModule, AngularMaterialModule],
    exports: [AngularMaterialModule],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CoreModule {}
