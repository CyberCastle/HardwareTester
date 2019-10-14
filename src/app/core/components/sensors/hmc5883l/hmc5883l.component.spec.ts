import { async, ComponentFixture, TestBed } from '@angular/core/testing'

import { HMC5883LComponent } from './hmc5883l.component'

describe('SerialportTestComponent', () => {
    let component: HMC5883LComponent
    let fixture: ComponentFixture<HMC5883LComponent>

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [HMC5883LComponent],
        }).compileComponents()
    }))

    beforeEach(() => {
        fixture = TestBed.createComponent(HMC5883LComponent)
        component = fixture.componentInstance
        fixture.detectChanges()
    })

    it('should create', () => {
        expect(component).toBeTruthy()
    })
})
