import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { AboutComponent } from './about/about.component'
import { CoreModule } from '../core/core.module'

@NgModule({
    declarations: [AboutComponent],
    imports: [CommonModule, CoreModule],
    entryComponents: [AboutComponent],
})
export class ModalsModule {}
