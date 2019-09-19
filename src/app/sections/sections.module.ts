import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { MainSectionComponent } from './main/main-section.component'
import { CoreModule } from '../core/core.module'

@NgModule({
    declarations: [MainSectionComponent],
    imports: [CommonModule, CoreModule],
})
export class SectionsModule {}
