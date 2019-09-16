import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { WebviewDirective } from './directives/'

@NgModule({
    declarations: [WebviewDirective],
    imports: [CommonModule, TranslateModule],
    exports: [TranslateModule, WebviewDirective],
})
export class SharedModule {}
